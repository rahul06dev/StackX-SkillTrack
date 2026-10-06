import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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

const API_BASE_URL = 'http://localhost:4300';

const AdminProjectsPage: React.FC = () => {
    const navigate = useNavigate();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>('ALL');

    useEffect(() => {
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
                    throw new Error('Failed to fetch projects');
                }

                const data: Project[] = await response.json();

                setProjects(data);
            } catch (error) {
                console.error(
                    'Failed to load admin projects:',
                    error
                );

                setProjects([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, []);

    /* Search */
    const filteredProjects = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        const matchesWordStart = (text: string) => {
            const words = text
                .toLowerCase()
                .split(/[\s\-_.,!?()[\]{}:;]+/)
                .filter(Boolean);

            return words.some((word) =>
                word.startsWith(normalizedSearch)
            );
        };

        const statusMatches = (project: Project) => {
            return (
                statusFilter === 'ALL' ||
                project.status === statusFilter
            );
        };

        const statusFilteredProjects = projects.filter(statusMatches);

        if (!normalizedSearch) {
            return statusFilteredProjects;
        }

        const titleMatches = statusFilteredProjects.filter((project) =>
            matchesWordStart(project.title)
        );

        const descriptionMatches = statusFilteredProjects.filter((project) => {
            const titleMatchesSearch = matchesWordStart(project.title);
            const descriptionMatchesSearch = matchesWordStart(
                project.description
            );

            return (
                !titleMatchesSearch &&
                descriptionMatchesSearch
            );
        });

        return [
            ...titleMatches,
            ...descriptionMatches,
        ];
    }, [projects, searchTerm, statusFilter]);

    const clearSearch = () => {
        setSearchTerm('');
    };

    return (
        <div className="admin-page">
            <Sidebar activeTab="projects" />

            <main className="admin-main">

                {/* Page Header */}
                <header className="admin-header">
                    <div>
                        <h1>All Projects</h1>
                        <p>
                            View and manage projects across the
                            SkillTrack platform.
                        </p>
                    </div>

                    <button
                        className="admin-primary-button"
                        onClick={() => {
                            console.log('Create project clicked');
                        }}
                    >
                        <i className="fa fa-plus"></i>
                        New Project
                    </button>
                </header>

                {/* Search & Filters */}
                <section className="admin-project-toolbar">

                    <div className="admin-project-search">
                        <i className="fa fa-search"></i>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
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
                                <i className="fa fa-times"></i>
                            </button>
                        )}
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(
                                e.target.value as StatusFilter
                            )
                        }
                        className="admin-project-filter"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">
                            Completed
                        </option>
                    </select>

                </section>

                {/* Project Count */}
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

                {/* Project Content */}
                {loading ? (
                    <div className="admin-empty-state">
                        <h3>Loading projects...</h3>
                        <p>
                            Please wait while projects are being
                            loaded.
                        </p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="admin-empty-state">

                        <i className="fa fa-folder-open"></i>

                        <h3>
                            {searchTerm
                                ? 'No projects found'
                                : 'No projects available'}
                        </h3>

                        <p>
                            {searchTerm
                                ? `No projects match "${searchTerm}". Try a different search.`
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
                            >
                                <div className="admin-management-project-main">
                                    <div className="admin-management-project-icon">
                                        <i className="fa fa-folder-open"></i>
                                    </div>

                                    <div className="admin-management-project-info">
                                        <h3>{project.title}</h3>

                                        <p>
                                            {project.description ||
                                                'No project description available.'}
                                        </p>

                                        <div className="admin-management-project-stats">
                                            <span>
                                                <i className="fa fa-tasks"></i>
                                                {project.tasksCount} Tasks
                                            </span>

                                            <span>
                                                <i className="fa fa-users"></i>
                                                {project.peopleCount} People
                                            </span>

                                            <span
                                                className={`admin-project-status ${project.status.toLowerCase()}`}
                                            >
                                                {project.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-management-project-arrow">
                                    <i className="fa fa-chevron-right"></i>
                                </div>
                            </div>
                        ))}

                    </div>
                )}

            </main>
        </div>
    );
};

export default AdminProjectsPage;