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

const API_BASE_URL = 'http://localhost:4300';

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch students when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchStudents = async () => {
      setLoadingStudents(true);

      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          `${API_BASE_URL}/api/users/students`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch students');
        }

        const data = await response.json();
        setStudents(data);
      } catch (err) {
        console.error('Error fetching students:', err);
        setError('Could not load students.');
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [isOpen]);

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

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          studentIds: selectedStudentIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project on the server.');
      }

      const newProjectData = await response.json();

      onProjectCreated(newProjectData);

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedStudentIds([]);
      setError(null);

      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Could not create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 bg-opacity-75 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl w-full max-w-lg shadow-2xl">

        {/* Modal Header */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold">Create New Project</h2>

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
              placeholder="Enter project title"
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
              placeholder="Describe the project..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 resize-none"
              required
            />
          </div>

          {/* Student Assignment */}
          <div className="mb-6">
            <label className="block text-md font-semibold mb-2">
              Assign Students
            </label>

            {loadingStudents ? (
              <div className="p-3 border border-gray-300 rounded-xl text-gray-500">
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="p-3 border border-gray-300 rounded-xl text-gray-500">
                No students available.
              </div>
            ) : (
              <div className="border border-gray-300 rounded-xl max-h-40 overflow-y-auto">
                {students.map((student) => (
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
                ))}
              </div>
            )}

            {selectedStudentIds.length > 0 && (
              <p className="text-sm text-purple-600 mt-2">
                {selectedStudentIds.length} student
                {selectedStudentIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-500 mb-4">
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
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
