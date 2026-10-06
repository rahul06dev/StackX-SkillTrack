import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import KanbanColumn from '../components/KanbanColumn';
import AddColumnModal from '../components/AddColumnModal';
import ManageTeamModal from '../components/ManageTeamModal';
import ProjectSkills from '../components/ProjectSkills';

interface ProjectPerson {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface ProjectDetails {
  title: string;
  description: string;
  students: ProjectPerson[];
  faculty: ProjectPerson[];
  admins: ProjectPerson[];
}

interface Column {
  id: string;
  title: string;
  projectId: string;
  colorClass: string;
  order: number;
  count: number;
}

interface ColorTheme {
  name: string;
  class: string;
}

const API_BASE_URL = 'http://localhost:4300';

const ProjectBoardPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const parsedProjectId = projectId;

  const [searchParams] = useSearchParams();
  const targetTaskId = searchParams.get('task');

  const [project, setProject] = useState<ProjectDetails>({
    title: 'Loading...',
    description: '',
    students: [],
    faculty: [],
    admins: [],
  });

  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);

  const [isManageTeamModalOpen, setIsManageTeamModalOpen] =
    useState(false);

  const [teamOptions, setTeamOptions] = useState<{
    students: ProjectPerson[];
    faculty: ProjectPerson[];
    admins: ProjectPerson[];
  }>({
    students: [],
    faculty: [],
    admins: [],
  });

  const [teamOptionsLoading, setTeamOptionsLoading] = useState(false);

  // --- MOVE TASK BETWEEN COLUMNS ---
  const handleTaskMove = useCallback(
    (
      taskId: string,
      sourceColumnId: string,
      targetColumnId: string
    ) => {
      console.log(
        `Task ${taskId} moved from ${sourceColumnId} to ${targetColumnId}`
      );

      setTaskRefreshKey(prev => prev + 1);
    },
    []
  );

  // --- DELETE COLUMN ---
  const handleColumnDelete = useCallback(async (columnId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this column and ALL of its tasks?'
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/columns/${columnId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 204) {
        setColumns(prev =>
          prev.filter(col => col.id !== columnId)
        );

        console.log(
          `✅ Column ${columnId} deleted successfully.`
        );
      } else {
        const errorBody = await response.json();

        throw new Error(
          errorBody.message ||
          `API error with status ${response.status}`
        );
      }
    } catch (err) {
      console.error('Error deleting column:', err);

      const message =
        err instanceof Error ? err.message : 'Unknown error';

      alert(`Failed to delete column: ${message}`);
    }
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      if (!parsedProjectId) {
        setError('Project ID is missing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        // 1. Fetch Project Details
        const projectResponse = await fetch(
          `${API_BASE_URL}/api/projects/${parsedProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!projectResponse.ok) {
          throw new Error('Failed to fetch project details.');
        }

        const projectData: ProjectDetails =
          await projectResponse.json();

        setProject({
          title: projectData.title,
          description: projectData.description,
          students: projectData.students || [],
          faculty: projectData.faculty || [],
          admins: projectData.admins || [],
        });

        // 2. Fetch Columns
        const columnsResponse = await fetch(
          `${API_BASE_URL}/api/columns?projectId=${parsedProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!columnsResponse.ok) {
          throw new Error('Failed to fetch columns.');
        }

        const fetchedColumns: Column[] =
          await columnsResponse.json();

        const dynamicColumns: Column[] = fetchedColumns.map(
          col => ({
            ...col,
            id: col.id.toString(),
            projectId: col.projectId.toString(),
            order: col.order,
            count: 0,
          })
        );

        setColumns(
          dynamicColumns.sort((a, b) => a.order - b.order)
        );
      } catch (err) {
        console.error('Board Data Fetch Error:', err);

        setError('Could not load project board data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [parsedProjectId]);

  // --- MODAL HANDLERS ---
  const handleOpenModal = () => {
    setIsAddColumnModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddColumnModalOpen(false);
  };

  // --- CREATE COLUMN ---
  const handleCreateColumn = useCallback(
    async (title: string, theme: ColorTheme) => {
      const nextOrder = columns.length;

      console.log(
        `[DEBUG 1] Attempting to create column: ${title}`
      );

      console.log(
        `[DEBUG 1] Project ID: ${parsedProjectId}, Color Class: ${theme.class}, Order: ${nextOrder}`
      );

      const requestBody = {
        title,
        projectId: parsedProjectId,
        colorClass: theme.class,
        order: nextOrder,
      };

      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        console.log(
          '[DEBUG 2] Request Body:',
          JSON.stringify(requestBody)
        );

        const response = await fetch(
          `${API_BASE_URL}/api/columns`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log(
          '[DEBUG 3] API Response Status:',
          response.status
        );

        if (!response.ok) {
          const errorBody = await response.json();

          console.error(
            '❌ API FAILURE (Status not OK):',
            errorBody
          );

          alert(
            `Failed to create column: ${
              errorBody.message || 'Server Error'
            }`
          );

          throw new Error(
            `Failed to create column: ${response.status}`
          );
        }

        console.log(
          '✅ API SUCCESS: Column created and received.'
        );

        const newColumnData: Column =
          await response.json();

        setColumns(prev =>
          [
            ...prev,
            {
              ...newColumnData,
              count: 0,
            },
          ].sort((a, b) => a.order - b.order)
        );

        handleCloseModal();
      } catch (err) {
        console.error('❌ FATAL CATCH ERROR:', err);
      }
    },
    [parsedProjectId, columns]
  );

  const completedColumnId = columns.find(
    column => column.title === 'Completed'
  )?.id;

  const inProgressColumnId = columns.find(
    column => column.title === 'In Progress'
  )?.id;

  const handleTaskAutoOpened = useCallback(() => {
    navigate(`/projects/${parsedProjectId}`, {
      replace: true,
    });
  }, [navigate, parsedProjectId]);

  const fetchTeamOptions = useCallback(async () => {
    try {
      setTeamOptionsLoading(true);

      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/projects/team-options`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to fetch team options.'
        );
      }

      setTeamOptions({
        students: data.students || [],
        faculty: data.faculty || [],
        admins: data.admins || [],
      });
    } catch (error) {
      console.error(
        '❌ Error fetching project team options:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch team options.';

      alert(message);
    } finally {
      setTeamOptionsLoading(false);
    }
  }, []);

  const handleSaveTeam = useCallback(
    async (teamData: {
      studentIds: string[];
      facultyId: string | null;
      adminIds: string[];
    }) => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          `${API_BASE_URL}/api/projects/${parsedProjectId}/team`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(teamData),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Failed to update project team.'
          );
        }

        // Refresh project details after saving
        const projectResponse = await fetch(
          `${API_BASE_URL}/api/projects/${parsedProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!projectResponse.ok) {
          throw new Error(
            'Team updated, but project details could not be refreshed.'
          );
        }

        const updatedProject: ProjectDetails =
          await projectResponse.json();

        setProject({
          title: updatedProject.title,
          description: updatedProject.description,
          students: updatedProject.students || [],
          faculty: updatedProject.faculty || [],
          admins: updatedProject.admins || [],
        });

        setIsManageTeamModalOpen(false);

        console.log('✅ Project team updated successfully.');
      } catch (error) {
        console.error(
          '❌ Error updating project team:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update project team.';

        alert(message);
      }
    },
    [parsedProjectId]
  );

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="flex">
        <Sidebar activeTab="projects" />

        <div className="flex-1 p-10 dashboard-page-bg">
          <p>Loading project board...</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="flex">
        <Sidebar activeTab="projects" />

        <div className="flex-1 p-10 dashboard-page-bg">
          <h2>Unable to load project board</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar activeTab="projects" />

      <div className="flex-1 p-10 dashboard-page-bg">

        {/* Header Section */}
        <div className="mb-8">

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold project-board-title">
                {project.title}
              </h1>

              <p className="text-gray-600 max-w-4xl">
                {project.description}
              </p>
            </div>

            <button
              className="add-column-button flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition"
              onClick={handleOpenModal}
            >
              <i className="fa fa-plus"></i>
              Add Column
            </button>
          </div>

          {/* Project Team */}
          <div className="project-team-section">

            <div className="project-team-heading">
              <div>
                <h2>Project Team</h2>
                <p>People assigned to this project</p>
              </div>

              <div className="project-team-heading-actions">
                <span className="project-team-count">
                  {project.students.length +
                    project.faculty.length +
                    project.admins.length}{' '}
                  People
                </span>

                <button
                  type="button"
                  className="manage-team-button"
                  onClick={() => {
                    setIsManageTeamModalOpen(true);
                    fetchTeamOptions();
                  }}
                >
                  <i className="fa fa-users-cog"></i>
                  Manage Team
                </button>
              </div>
            </div>

            <div className="project-team-groups">

              {/* Students */}
              {project.students.length > 0 && (
                <div className="project-team-group">
                  <span className="project-team-role">
                    <i className="fa fa-graduation-cap"></i>
                    Students
                  </span>

                  <div className="project-team-people">
                    {project.students.map(person => (
                      <div
                        key={person.id}
                        className="project-team-person"
                        title={person.email}
                      >
                        <div className="project-team-avatar">
                          {person.name.charAt(0).toUpperCase()}
                        </div>

                        <span>{person.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Faculty */}
              {project.faculty.length > 0 && (
                <div className="project-team-group">
                  <span className="project-team-role">
                    <i className="fa fa-user-tie"></i>
                    Faculty
                  </span>

                  <div className="project-team-people">
                    {project.faculty.map(person => (
                      <div
                        key={person.id}
                        className="project-team-person"
                        title={person.email}
                      >
                        <div className="project-team-avatar">
                          {person.name.charAt(0).toUpperCase()}
                        </div>

                        <span>{person.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admins */}
              {project.admins.length > 0 && (
                <div className="project-team-group">
                  <span className="project-team-role">
                    <i className="fa fa-shield-alt"></i>
                    Admins
                  </span>

                  <div className="project-team-people">
                    {project.admins.map(person => (
                      <div
                        key={person.id}
                        className="project-team-person"
                        title={person.email}
                      >
                        <div className="project-team-avatar">
                          {person.name.charAt(0).toUpperCase()}
                        </div>

                        <span>{person.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* Project Skills */}
        <ProjectSkills projectId={projectId!} />

        {/* Kanban Board Columns */}
        <div className="kanban-board-grid">

          {columns.length > 0 ? (
            columns.map(column => (
              <KanbanColumn
                key={column.id}
                columnId={column.id}
                title={column.title}
                colorClass={column.colorClass}
                onColumnDelete={handleColumnDelete}
                onTaskMove={handleTaskMove}
                refreshKey={taskRefreshKey}
                completedColumnId={completedColumnId}
                inProgressColumnId={inProgressColumnId}
                targetTaskId={targetTaskId}
                onTaskAutoOpened={handleTaskAutoOpened}
              />
            ))
          ) : (
            <p className="text-gray-500">
              No columns found for this project. Add one now!
            </p>
          )}

        </div>
      </div>

      {/* Add Column Modal */}
      {isAddColumnModalOpen && (
        <AddColumnModal
          isOpen={isAddColumnModalOpen}
          onClose={handleCloseModal}
          onColumnCreate={handleCreateColumn}
        />
      )}

      {/* Manage Team Modal */}
      {isManageTeamModalOpen && (
        <ManageTeamModal
          isOpen={isManageTeamModalOpen}
          onClose={() => setIsManageTeamModalOpen(false)}
          students={teamOptions.students}
          faculty={teamOptions.faculty}
          admins={teamOptions.admins}
          assignedStudents={project.students}
          assignedFaculty={project.faculty}
          assignedAdmins={project.admins}
          onSave={handleSaveTeam}
        />
      )}

    </div>
  );
};

export default ProjectBoardPage;