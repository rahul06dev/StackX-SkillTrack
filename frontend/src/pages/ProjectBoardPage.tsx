import { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import Sidebar from '../components/Sidebar';
import KanbanColumn, { type Task } from '../components/KanbanColumn';
import AddColumnModal from '../components/AddColumnModal';
import ManageTeamModal from '../components/ManageTeamModal';
import ProjectSkills from '../components/ProjectSkills';
import ActivityHistoryModal from '../components/ActivityHistoryModal';

interface ProjectPerson {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface ProjectDetails {
  id?: string;
  title: string;
  description: string;
  createdById?: string;
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
  tasks: Task[];
}

interface ColorTheme {
  name: string;
  class: string;
}

import { API_BASE_URL } from '../config/api';

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

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isOwner = user?.id ? project.createdById === user.id : false;
  const isAdmin = user?.role === 'ADMIN';
  const isFacultySupervisor = project.faculty.some(f => f.id === user?.id);
  const canManageTeam = isOwner || isAdmin || isFacultySupervisor;

  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

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

  const [, setTeamOptionsLoading] = useState(false);

  // --- KANBAN DRAG & DROP WITH ROLE RESTRICTIONS & OPTIMISTIC UPDATES ---
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceCol = columns.find((c) => c.id === source.droppableId);
      const destCol = columns.find((c) => c.id === destination.droppableId);
      if (!sourceCol || !destCol) return;

      // Role-based movement permissions
      const userData = localStorage.getItem('user');
      let userRole: string | null = null;
      try {
        userRole = userData ? JSON.parse(userData)?.role : null;
      } catch {
        userRole = null;
      }

      if (destCol.title === 'Completed' && userRole === 'STUDENT') {
        alert('Permission Denied: Only Faculty or Admin can mark a task as Completed.');
        return;
      }

      if (destCol.title === 'Completed' && sourceCol.title !== 'In Review') {
        alert('Workflow Notice: A task must be moved to "In Review" before it can be Completed.');
        return;
      }

      // Snapshot previous columns for rollback on failure
      const previousColumns = columns;

      // Optimistic update
      const sourceTasks = Array.from(sourceCol.tasks || []);
      const [movedTask] = sourceTasks.splice(source.index, 1);
      if (!movedTask) return;

      const updatedTask: Task = { ...movedTask, columnId: destCol.id };

      let updatedColumns: Column[];
      if (sourceCol.id === destCol.id) {
        sourceTasks.splice(destination.index, 0, updatedTask);
        updatedColumns = columns.map((col) =>
          col.id === sourceCol.id ? { ...col, tasks: sourceTasks } : col
        );
      } else {
        const destTasks = Array.from(destCol.tasks || []);
        destTasks.splice(destination.index, 0, updatedTask);
        updatedColumns = columns.map((col) => {
          if (col.id === sourceCol.id) return { ...col, tasks: sourceTasks };
          if (col.id === destCol.id) return { ...col, tasks: destTasks };
          return col;
        });
      }

      setColumns(updatedColumns);

      // Persist changes to PostgreSQL
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication token not found');

        const response = await fetch(`${API_BASE_URL}/api/tasks/reorder`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            taskId: draggableId,
            targetColumnId: destination.droppableId,
            newIndex: destination.index,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to move task.');
        }

        if (userRole === 'STUDENT' && destCol.title === 'In Review') {
          alert('Task submitted for Faculty Review! Your supervisor will be notified.');
        }
      } catch (err) {
        console.error('Task move error:', err);
        setColumns(previousColumns); // Rollback
        alert(err instanceof Error ? err.message : 'Could not move task. Reverting position.');
      }
    },
    [columns]
  );

  // --- TASK STATE HANDLERS ---
  const handleTaskCreate = useCallback((columnId: string, newTask: Task) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, tasks: [...(col.tasks || []), newTask] }
          : col
      )
    );
  }, []);

  const handleTaskSave = useCallback((updatedTask: Task) => {
    setColumns((prev) =>
      prev.map((col) => {
        const filtered = (col.tasks || []).filter((t) => t.id !== updatedTask.id);
        if (col.id === updatedTask.columnId) {
          return { ...col, tasks: [...filtered, updatedTask] };
        }
        return { ...col, tasks: filtered };
      })
    );
  }, []);

  const handleTaskDelete = useCallback((taskId: string) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        tasks: (col.tasks || []).filter((t) => t.id !== taskId),
      }))
    );
  }, []);

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
          id: projectData.id,
          title: projectData.title,
          description: projectData.description,
          createdById: (projectData as any).createdById,
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
          (col: any) => ({
            ...col,
            id: col.id.toString(),
            projectId: col.projectId.toString(),
            order: col.order,
            tasks: (col.tasks || []).map((t: any) => ({
              ...t,
              dueDate: t.dueDate ? new Date(t.dueDate) : null,
            })),
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
              tasks: [],
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
          id: updatedProject.id,
          title: updatedProject.title,
          description: updatedProject.description,
          createdById: (updatedProject as any).createdById,
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

  const fetchProjectDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/projects/${parsedProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProject({
          id: data.id,
          title: data.title,
          description: data.description,
          createdById: data.createdById,
          students: data.students || [],
          faculty: data.faculty || [],
          admins: data.admins || [],
        });
      }
    } catch (err) {
      console.error('Error refreshing project details:', err);
    }
  }, [parsedProjectId]);

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar activeTab="projects" />

        <div className="flex-1 p-4 sm:p-6 lg:p-10 dashboard-page-bg">
          <p>Loading project board...</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar activeTab="projects" />

        <div className="flex-1 p-4 sm:p-6 lg:p-10 dashboard-page-bg">
          <h2>Unable to load project board</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar activeTab="projects" />

      <div className="flex-1 p-4 sm:p-6 lg:p-10 dashboard-page-bg">

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

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="activity-button flex items-center gap-2 px-5 py-3 rounded-xl font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition shadow-sm"
                onClick={() => setIsActivityModalOpen(true)}
              >
                <i className="fa fa-history text-purple-600"></i>
                Activity History
              </button>

              <button
                type="button"
                className="add-column-button flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition"
                onClick={handleOpenModal}
              >
                <i className="fa fa-plus"></i>
                Add Column
              </button>
            </div>
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

                {canManageTeam && (
                  <button
                    type="button"
                    className="manage-team-button"
                    onClick={() => {
                      setIsManageTeamModalOpen(true);
                      if (isAdmin) {
                        fetchTeamOptions();
                      }
                    }}
                  >
                    <i className="fa fa-users-cog"></i>
                    {isOwner ? 'Invite & Manage Team' : 'Manage Team'}
                  </button>
                )}
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

        {/* Kanban Board Columns with Drag and Drop */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="kanban-board-grid">
            {columns.length > 0 ? (
              columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  columnId={column.id}
                  title={column.title}
                  colorClass={column.colorClass}
                  tasks={column.tasks || []}
                  onColumnDelete={handleColumnDelete}
                  onTaskCreate={handleTaskCreate}
                  onTaskSave={handleTaskSave}
                  onTaskDelete={handleTaskDelete}
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
        </DragDropContext>
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
          projectId={parsedProjectId!}
          createdById={project.createdById}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          students={teamOptions.students}
          faculty={teamOptions.faculty}
          admins={teamOptions.admins}
          assignedStudents={project.students}
          assignedFaculty={project.faculty}
          assignedAdmins={project.admins}
          onSave={handleSaveTeam}
          onTeamUpdated={fetchProjectDetails}
        />
      )}

      {/* Activity History Modal */}
      {isActivityModalOpen && (
        <ActivityHistoryModal
          projectId={parsedProjectId!}
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
        />
      )}

    </div>
  );
};

export default ProjectBoardPage;