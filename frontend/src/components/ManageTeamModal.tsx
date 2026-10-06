import React, { useEffect, useState } from 'react';

interface ProjectPerson {
    id: string;
    name: string;
    email: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface ManageTeamModalProps {
    isOpen: boolean;
    onClose: () => void;

    students: ProjectPerson[];
    faculty: ProjectPerson[];
    admins: ProjectPerson[];

    assignedStudents: ProjectPerson[];
    assignedFaculty: ProjectPerson[];
    assignedAdmins: ProjectPerson[];

    onSave: (data: {
        studentIds: string[];
        facultyId: string | null;
        adminIds: string[];
    }) => Promise<void>;
}

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
    isOpen,
    onClose,
    students,
    faculty,
    admins,
    assignedStudents,
    assignedFaculty,
    assignedAdmins,
    onSave,
}) => {
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
        []
    );

    const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(
        null
    );

    const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setSelectedStudentIds(
            assignedStudents.map((student) => student.id)
        );

        setSelectedFacultyId(
            assignedFaculty.length > 0
                ? assignedFaculty[0].id
                : null
        );

        setSelectedAdminIds(
            assignedAdmins.map((admin) => admin.id)
        );
    }, [
        isOpen,
        assignedStudents,
        assignedFaculty,
        assignedAdmins,
    ]);

    if (!isOpen) {
        return null;
    }

    const handleStudentToggle = (studentId: string) => {
        setSelectedStudentIds((prev) =>
            prev.includes(studentId)
                ? prev.filter((id) => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleAdminToggle = (adminId: string) => {
        setSelectedAdminIds((prev) =>
            prev.includes(adminId)
                ? prev.filter((id) => id !== adminId)
                : [...prev, adminId]
        );
    };

    const handleFacultySelect = (facultyId: string) => {
        setSelectedFacultyId(
            selectedFacultyId === facultyId ? null : facultyId
        );
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            await onSave({
                studentIds: selectedStudentIds,
                facultyId: selectedFacultyId,
                adminIds: selectedAdminIds,
            });
        } catch (error) {
            console.error('Error saving project team:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="manage-team-modal-overlay"
            onClick={onClose}
        >
            <div
                className="manage-team-modal"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="manage-team-modal-header">
                    <div>
                        <h2>Manage Project Team</h2>
                        <p>
                            Assign students, faculty, and admins to this project.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="manage-team-close-button"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close"
                    >
                        <i className="fa fa-times"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="manage-team-modal-body">

                    {/* Students */}
                    <div className="manage-team-section">
                        <div className="manage-team-section-header">
                            <div>
                                <h3>
                                    <i className="fa fa-graduation-cap"></i>
                                    Students
                                </h3>

                                <p>
                                    Select the students working on this project.
                                </p>
                            </div>

                            <span>
                                {selectedStudentIds.length} selected
                            </span>
                        </div>

                        <div className="manage-team-user-list">
                            {students.length > 0 ? (
                                students.map((student) => {
                                    const isSelected = selectedStudentIds.includes(
                                        student.id
                                    );

                                    return (
                                        <label
                                            key={student.id}
                                            className={`manage-team-user ${isSelected ? 'selected' : ''
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() =>
                                                    handleStudentToggle(student.id)
                                                }
                                            />

                                            <div className="manage-team-user-avatar">
                                                {student.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="manage-team-user-info">
                                                <strong>{student.name}</strong>
                                                <span>{student.email}</span>
                                            </div>

                                            <div className="manage-team-check">
                                                <i className="fa fa-check"></i>
                                            </div>
                                        </label>
                                    );
                                })
                            ) : (
                                <div className="manage-team-empty">
                                    <i className="fa fa-users"></i>
                                    <span>No students available.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Faculty */}
                    <div className="manage-team-section">
                        <div className="manage-team-section-header">
                            <div>
                                <h3>
                                    <i className="fa fa-user-tie"></i>
                                    Faculty
                                </h3>

                                <p>
                                    Select the faculty guide supervising this project.
                                </p>
                            </div>

                            <span>
                                {selectedFacultyId ? '1 selected' : 'None selected'}
                            </span>
                        </div>

                        <div className="manage-team-user-list">
                            {faculty.length > 0 ? (
                                faculty.map((person) => {
                                    const isSelected =
                                        selectedFacultyId === person.id;

                                    return (
                                        <label
                                            key={person.id}
                                            className={`manage-team-user ${isSelected ? 'selected' : ''
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="project-faculty"
                                                checked={isSelected}
                                                onChange={() =>
                                                    handleFacultySelect(person.id)
                                                }
                                            />

                                            <div className="manage-team-user-avatar faculty">
                                                {person.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="manage-team-user-info">
                                                <strong>{person.name}</strong>
                                                <span>{person.email}</span>
                                            </div>

                                            <div className="manage-team-check">
                                                <i className="fa fa-check"></i>
                                            </div>
                                        </label>
                                    );
                                })
                            ) : (
                                <div className="manage-team-empty">
                                    <i className="fa fa-user-tie"></i>
                                    <span>No faculty available.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Admins */}
                    <div className="manage-team-section">
                        <div className="manage-team-section-header">
                            <div>
                                <h3>
                                    <i className="fa fa-shield-alt"></i>
                                    Admins
                                </h3>

                                <p>
                                    Select admins who should have project access.
                                </p>
                            </div>

                            <span>
                                {selectedAdminIds.length} selected
                            </span>
                        </div>

                        <div className="manage-team-user-list">
                            {admins.length > 0 ? (
                                admins.map((admin) => {
                                    const isSelected = selectedAdminIds.includes(
                                        admin.id
                                    );

                                    return (
                                        <label
                                            key={admin.id}
                                            className={`manage-team-user ${isSelected ? 'selected' : ''
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() =>
                                                    handleAdminToggle(admin.id)
                                                }
                                            />

                                            <div className="manage-team-user-avatar admin">
                                                {admin.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div className="manage-team-user-info">
                                                <strong>{admin.name}</strong>
                                                <span>{admin.email}</span>
                                            </div>

                                            <div className="manage-team-check">
                                                <i className="fa fa-check"></i>
                                            </div>
                                        </label>
                                    );
                                })
                            ) : (
                                <div className="manage-team-empty">
                                    <i className="fa fa-shield-alt"></i>
                                    <span>No admins available.</span>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="manage-team-modal-footer">
                    <button
                        type="button"
                        className="manage-team-cancel-button"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="manage-team-save-button"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <i className="fa fa-spinner fa-spin"></i>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-check"></i>
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManageTeamModal;