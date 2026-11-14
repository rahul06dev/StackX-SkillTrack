import React, { useEffect, useState } from 'react';

// Define props for the modal
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (newProject: any) => void;
}

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Faculty {
  id: string;
  name: string;
  email: string;
}

import { API_BASE_URL } from '../config/api';

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isStudent = user?.role === 'STUDENT';
  const isAdmin = user?.role === 'ADMIN';

  // Fetch students & faculty when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchFaculty = async () => {
      try {
        let response = await fetch(`${API_BASE_URL}/api/projects/faculty-list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // Fallback to /api/users/faculty
          response = await fetch(`${API_BASE_URL}/api/users/faculty`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (response.ok) {
          const data = await response.json();
          setFacultyList(Array.isArray(data) ? data : []);
        } else {
          console.warn('Failed to load faculty list:', response.status);
        }
      } catch (err) {
        console.error('Error fetching faculty list:', err);
      }
    };

    // Fetch student directory (for Admin assignment or Student teammate invitations)
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/students`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data: Student[] = await response.json();
          // Filter out current user for student creators
          const filtered = isStudent && user?.id
            ? data.filter((s) => s.id !== user.id)
            : data;
          setStudents(filtered);
        }
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();

    // Both students (choosing supervisor) and admins (assigning faculty guide) need faculty list
    if (isStudent || isAdmin) {
      fetchFaculty();
    }
  }, [isOpen, isStudent, isAdmin, user?.id]);

  if (!isOpen) return null;

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError('Title and Description are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        technologies: technologies.trim(),
        studentIds: selectedStudentIds,
      };

      if (selectedFacultyId) {
        payload.assignedFacultyId = selectedFacultyId;
      }

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.message || 'Failed to create project on the server.');
      }

      const newProjectData = await response.json();
      onProjectCreated(newProjectData);

      // Reset form
      setTitle('');
      setDescription('');
      setTechnologies('');
      setSelectedStudentIds([]);
      setSelectedFacultyId('');
      setStudentSearch('');
      setError(null);

      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err instanceof Error ? err.message : 'Could not create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white p-5 sm:p-7 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {isStudent ? 'Start Your Project' : 'Create New Project'}
            </h2>
            <p className="text-sm text-gray-500">
              {isStudent
                ? 'Create an academic project, log tools & technologies, and request faculty guidance.'
                : 'Define a project, map competency skills, and assign students.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-3xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Project Title */}
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-md font-semibold mb-2"
            >
              Project Title *
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Healthcare Analytics Dashboard"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-md font-semibold mb-2"
            >
              Description *
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              placeholder="Describe the project objectives, scope, and implementation plan..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 resize-none"
              required
            />
          </div>

          {/* Technologies & Tools (Rule-Based Mapping Engine Input) */}
          <div className="mb-4">
            <label
              htmlFor="technologies"
              className="block text-md font-semibold mb-1"
            >
              Tools & Technologies (T)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Comma-separated technologies (e.g. <code>React, Node.js, PostgreSQL, Docker</code>). The rule engine automatically maps these to competency skills.
            </p>

            <input
              id="technologies"
              type="text"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              placeholder="React, TypeScript, Express, PostgreSQL"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Faculty Guide Selector (For Students to choose guide, or Admins to assign supervisor) */}
          {(isStudent || isAdmin) && (
            <div className="mb-4">
              <label htmlFor="faculty-guide" className="block text-md font-semibold mb-1">
                {isAdmin ? 'Assign Faculty Guide / Supervisor (Optional)' : 'Invite Faculty Supervisor (Optional)'}
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {isStudent
                  ? 'An academic supervision invitation will be sent to the selected faculty member.'
                  : 'Assign a faculty guide to oversee academic progress and skill verifications.'}
              </p>
              <select
                id="faculty-guide"
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 bg-white"
              >
                <option value="">Select a Faculty Guide...</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Student Team Members (Direct Assignment for Admin, Invitations for Students) */}
          <div className="mb-6">
            <label className="block text-md font-semibold mb-1">
              {isStudent ? 'Invite Student Teammates (Optional)' : 'Assign Students'}
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {isStudent
                ? 'Invitations will be sent to the selected students. They will join the project upon accepting.'
                : 'Selected students will be assigned directly to the project.'}
            </p>

            {loadingStudents ? (
              <div className="p-3 border border-gray-300 rounded-xl text-gray-500">
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="p-3 border border-gray-300 rounded-xl text-gray-500">
                {isStudent ? 'No other students available.' : 'No students available.'}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search students by name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full mb-2 p-2.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
                <div className="border border-gray-300 rounded-xl max-h-40 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-xs text-gray-400 text-center">
                      No matching students found.
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          className="w-4 h-4"
                        />

                        <div>
                          <p className="font-medium text-gray-800">
                            {student.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {student.email}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {selectedStudentIds.length > 0 && (
              <p className="text-sm text-purple-600 mt-2">
                {selectedStudentIds.length} student
                {selectedStudentIds.length !== 1 ? 's' : ''} {isStudent ? 'to invite' : 'selected'}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-500 mb-4 text-sm bg-red-50 p-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-semibold text-gray-700 border border-gray-300 hover:bg-gray-100 transition"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="create-project-button px-6 py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : isStudent ? 'Submit Project' : 'Create Project'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
