import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

interface ProjectPerson {
    id: string;
    name: string;
    email: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface ProjectInvitationRecord {
    id: string;
    projectId: string;
    type: 'TEAM_MEMBER' | 'FACULTY_GUIDE';
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
    message: string | null;
    createdAt: string;
    recipient: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    invitedBy: {
        id: string;
        name: string;
        email: string;
    };
}

interface ManageTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    createdById?: string;
    currentUserRole?: string;
    currentUserId?: string;

    students: ProjectPerson[];
    faculty: ProjectPerson[];
    admins: ProjectPerson[];

    assignedStudents: ProjectPerson[];
    assignedFaculty: ProjectPerson[];
    assignedAdmins: ProjectPerson[];

    onSave?: (data: {
        studentIds: string[];
        facultyId?: string | null;
        facultyIds?: string[];
        adminIds: string[];
    }) => Promise<void>;

    onTeamUpdated?: () => void;
}

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
    isOpen,
    onClose,
    projectId,
    createdById,
    currentUserRole,
    currentUserId,
    students,
    faculty,
    admins,
    assignedStudents,
    assignedFaculty,
    assignedAdmins,
    onSave,
    onTeamUpdated,
}) => {
    const isOwner = currentUserId ? createdById === currentUserId : false;
    const isAdmin = currentUserRole === 'ADMIN';

    // Tabs: 'invite' (Owner/Admin), 'pending' (Owner/Admin), 'current' (All)
    const [activeTab, setActiveTab] = useState<'invite' | 'pending' | 'current'>(
        isOwner || currentUserRole === 'STUDENT' ? 'invite' : 'current'
    );

    // Direct Assignment State (Admin / Faculty)
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);
    const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Teammate Invitation State
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [studentSearchResults, setStudentSearchResults] = useState<ProjectPerson[]>([]);
    const [isSearchingStudents, setIsSearchingStudents] = useState(false);
    const [selectedStudentToInvite, setSelectedStudentToInvite] = useState<ProjectPerson | null>(null);
    const [teammateInviteMessage, setTeammateInviteMessage] = useState('');
    const [isSendingTeammateInvite, setIsSendingTeammateInvite] = useState(false);

    // Faculty Guide Invitation State
    const [availableFacultyList, setAvailableFacultyList] = useState<ProjectPerson[]>([]);
    const [selectedFacultyToInviteId, setSelectedFacultyToInviteId] = useState('');
    const [facultyInviteMessage, setFacultyInviteMessage] = useState('');
    const [isSendingFacultyInvite, setIsSendingFacultyInvite] = useState(false);

    // Pending Invitations State
    const [projectInvitations, setProjectInvitations] = useState<ProjectInvitationRecord[]>([]);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

    // Banner feedback
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Initialize Direct Assignment State
    useEffect(() => {
        if (!isOpen) return;

        setSelectedStudentIds(assignedStudents.map((s) => s.id));
        setSelectedFacultyIds(assignedFaculty.map((f) => f.id));
        setSelectedAdminIds(assignedAdmins.map((a) => a.id));
    }, [isOpen, assignedStudents, assignedFaculty, assignedAdmins]);

    // Fetch Project Invitations
    const fetchProjectInvitations = useCallback(async () => {
        if (!projectId) return;
        setLoadingInvitations(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/invitations/project/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data: ProjectInvitationRecord[] = await res.json();
                setProjectInvitations(data);
            }
        } catch (err) {
            console.error('Error fetching project invitations:', err);
        } finally {
            setLoadingInvitations(false);
        }
    }, [projectId]);

    // Fetch Faculty List for Supervision
    const fetchFacultyList = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/projects/faculty-list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableFacultyList(data);
            }
        } catch (err) {
            console.error('Error fetching faculty list:', err);
        }
    }, []);

    // Search Students to Invite
    const searchStudents = useCallback(async (query: string) => {
        if (!projectId) return;
        setIsSearchingStudents(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(
                `${API_BASE_URL}/api/invitations/search/students?projectId=${projectId}&q=${encodeURIComponent(query)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setStudentSearchResults(data);
            }
        } catch (err) {
            console.error('Error searching students:', err);
        } finally {
            setIsSearchingStudents(false);
        }
    }, [projectId]);

    // Load initial data on modal open
    useEffect(() => {
        if (!isOpen) return;
        fetchProjectInvitations();
        fetchFacultyList();
        searchStudents('');
    }, [isOpen, fetchProjectInvitations, fetchFacultyList, searchStudents]);

    if (!isOpen) return null;

    // Send Teammate Invitation
    const handleSendTeammateInvite = async () => {
        if (!selectedStudentToInvite) return;
        setIsSendingTeammateInvite(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/invitations/project/${projectId}/team`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    recipientId: selectedStudentToInvite.id,
                    message: teammateInviteMessage.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to send invitation');
            }

            showFeedback('success', `Invitation successfully sent to ${selectedStudentToInvite.name}!`);
            setSelectedStudentToInvite(null);
            setTeammateInviteMessage('');
            fetchProjectInvitations();
            searchStudents('');
        } catch (err) {
            showFeedback('error', err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setIsSendingTeammateInvite(false);
        }
    };

    // Send Faculty Supervision Invitation
    const handleSendFacultyInvite = async () => {
        if (!selectedFacultyToInviteId) return;
        setIsSendingFacultyInvite(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/invitations/project/${projectId}/faculty`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    recipientId: selectedFacultyToInviteId,
                    message: facultyInviteMessage.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to send faculty supervision request');
            }

            showFeedback('success', 'Faculty supervision invitation sent successfully!');
            setSelectedFacultyToInviteId('');
            setFacultyInviteMessage('');
            fetchProjectInvitations();
        } catch (err) {
            showFeedback('error', err instanceof Error ? err.message : 'Failed to send faculty request');
        } finally {
            setIsSendingFacultyInvite(false);
        }
    };

    // Cancel Pending Invitation
    const handleCancelInvitation = async (invitationId: string) => {
        if (!window.confirm('Cancel this pending invitation?')) return;
        setCancellingInviteId(invitationId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/cancel`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to cancel invitation');

            showFeedback('success', 'Invitation cancelled.');
            fetchProjectInvitations();
            searchStudents('');
        } catch (err) {
            showFeedback('error', 'Failed to cancel invitation');
        } finally {
            setCancellingInviteId(null);
        }
    };

    // Direct Assignment Toggle Handlers
    const handleStudentToggle = (studentId: string) => {
        setSelectedStudentIds((prev) =>
            prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
        );
    };

    const handleAdminToggle = (adminId: string) => {
        setSelectedAdminIds((prev) =>
            prev.includes(adminId) ? prev.filter((id) => id !== adminId) : [...prev, adminId]
        );
    };

    const handleFacultyToggle = (facultyId: string) => {
        setSelectedFacultyIds((prev) =>
            prev.includes(facultyId) ? prev.filter((id) => id !== facultyId) : [...prev, facultyId]
        );
    };

    // Direct Save (Admin / Faculty)
    const handleSaveDirect = async () => {
        if (!onSave) return;
        try {
            setSaving(true);
            await onSave({
                studentIds: selectedStudentIds,
                facultyId: selectedFacultyIds[0] || null,
                facultyIds: selectedFacultyIds,
                adminIds: selectedAdminIds,
            });
            if (onTeamUpdated) onTeamUpdated();
            onClose();
        } catch (error) {
            console.error('Error saving project team:', error);
            showFeedback('error', 'Failed to update project team.');
        } finally {
            setSaving(false);
        }
    };

    const pendingCount = projectInvitations.filter((i) => i.status === 'PENDING').length;

    return (
        <div className="manage-team-modal-overlay" onClick={onClose}>
            <div className="manage-team-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="manage-team-modal-header">
                    <div>
                        <h2>Manage Project Team & Invitations</h2>
                        <p>
                            {isOwner
                                ? 'Invite student teammates and request faculty supervision for your academic project.'
                                : 'Manage project team members, supervision, and active invitations.'}
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

                {/* Feedback Toast */}
                {feedback && (
                    <div
                        style={{
                            margin: '12px 26px 0',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
                            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                        }}
                    >
                        <i className={`fa ${feedback.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                        <span>{feedback.text}</span>
                    </div>
                )}

                {/* Tabs */}
                <div className="manage-team-tabs">
                    <button
                        type="button"
                        className={`manage-team-tab ${activeTab === 'invite' ? 'active' : ''}`}
                        onClick={() => setActiveTab('invite')}
                    >
                        <i className="fa fa-user-plus"></i>
                        Invite Members
                    </button>

                    <button
                        type="button"
                        className={`manage-team-tab ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <i className="fa fa-clock"></i>
                        Pending Invitations
                        {pendingCount > 0 && (
                            <span className="manage-team-tab-badge">{pendingCount}</span>
                        )}
                    </button>

                    <button
                        type="button"
                        className={`manage-team-tab ${activeTab === 'current' ? 'active' : ''}`}
                        onClick={() => setActiveTab('current')}
                    >
                        <i className="fa fa-users"></i>
                        Current Team ({assignedStudents.length + assignedFaculty.length + assignedAdmins.length})
                    </button>
                </div>

                {/* Modal Body */}
                <div className="manage-team-modal-body">
                    {/* TAB 1: INVITE MEMBERS */}
                    {activeTab === 'invite' && (
                        <div>
                            {/* Card A: Invite Teammates */}
                            <div className="invite-member-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <i className="fa fa-graduation-cap" style={{ color: '#4f46e5' }}></i>
                                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1f2937' }}>
                                        Invite Student Teammate
                                    </h3>
                                </div>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px' }}>
                                    Search for registered students to invite them to this project team.
                                </p>

                                <input
                                    type="text"
                                    className="invite-search-input"
                                    placeholder="Search student by name or email..."
                                    value={studentSearchQuery}
                                    onChange={(e) => {
                                        setStudentSearchQuery(e.target.value);
                                        searchStudents(e.target.value);
                                    }}
                                />

                                {isSearchingStudents ? (
                                    <p style={{ fontSize: '12px', color: '#9ca3af', padding: '8px 0' }}>
                                        Searching students...
                                    </p>
                                ) : studentSearchResults.length === 0 ? (
                                    <p style={{ fontSize: '12px', color: '#9ca3af', padding: '8px 0' }}>
                                        No available students found.
                                    </p>
                                ) : (
                                    <div className="invite-search-results">
                                        {studentSearchResults.map((s) => {
                                            const isSelected = selectedStudentToInvite?.id === s.id;
                                            return (
                                                <div
                                                    key={s.id}
                                                    className={`invite-search-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setSelectedStudentToInvite(isSelected ? null : s)}
                                                >
                                                    <div>
                                                        <strong style={{ fontSize: '13px', color: '#374151' }}>{s.name}</strong>
                                                        <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                                                            {s.email}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: isSelected ? '#4f46e5' : '#eef2ff',
                                                            color: isSelected ? '#fff' : '#4f46e5',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {isSelected ? '✓ Selected' : '+ Select'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {selectedStudentToInvite && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: '#f5f7ff', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '13px', marginBottom: '8px', color: '#1e1b4b' }}>
                                            Sending team invitation to <strong>{selectedStudentToInvite.name}</strong>
                                        </div>
                                        <input
                                            type="text"
                                            className="invite-search-input"
                                            placeholder="Optional message (e.g. 'Looking forward to collaborating on frontend components')"
                                            value={teammateInviteMessage}
                                            onChange={(e) => setTeammateInviteMessage(e.target.value)}
                                            style={{ marginBottom: '8px' }}
                                        />
                                        <button
                                            type="button"
                                            className="student-primary-button"
                                            onClick={handleSendTeammateInvite}
                                            disabled={isSendingTeammateInvite}
                                        >
                                            {isSendingTeammateInvite ? 'Sending...' : 'Send Team Invitation'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Card B: Invite Faculty Supervisor */}
                            <div className="invite-member-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <i className="fa fa-user-tie" style={{ color: '#d97706' }}></i>
                                    <h3 style={{ margin: 0, fontSize: '15px', color: '#1f2937' }}>
                                        Faculty Supervisor / Academic Guide
                                    </h3>
                                </div>

                                {assignedFaculty.length > 0 && (
                                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {assignedFaculty.map((f) => (
                                            <div key={f.id} style={{ padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                                                <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
                                                    <i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>
                                                    Prof. {f.name} ({f.email})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px' }}>
                                        {assignedFaculty.length > 0
                                            ? 'Invite another faculty member as an additional academic supervisor/guide.'
                                            : 'Select a faculty member to invite them as the official academic guide for this project.'}
                                    </p>
                                    <select
                                        className="invite-search-input"
                                        value={selectedFacultyToInviteId}
                                        onChange={(e) => setSelectedFacultyToInviteId(e.target.value)}
                                    >
                                        <option value="">Select a Faculty Guide...</option>
                                        {availableFacultyList
                                            .filter((f) => !assignedFaculty.some((af) => af.id === f.id))
                                            .map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name} ({f.email})
                                                </option>
                                            ))}
                                    </select>

                                    {selectedFacultyToInviteId && (
                                        <div style={{ marginTop: '8px' }}>
                                            <input
                                                type="text"
                                                className="invite-search-input"
                                                placeholder="Optional message (e.g. 'Requesting your guidance on machine learning evaluation')"
                                                value={facultyInviteMessage}
                                                onChange={(e) => setFacultyInviteMessage(e.target.value)}
                                                style={{ marginBottom: '8px' }}
                                            />
                                            <button
                                                type="button"
                                                className="student-primary-button"
                                                style={{ background: '#d97706' }}
                                                onClick={handleSendFacultyInvite}
                                                disabled={isSendingFacultyInvite}
                                            >
                                                {isSendingFacultyInvite ? 'Sending...' : 'Send Supervision Invitation'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: PENDING INVITATIONS */}
                    {activeTab === 'pending' && (
                        <div>
                            {loadingInvitations ? (
                                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0' }}>
                                    Loading invitations...
                                </p>
                            ) : projectInvitations.length === 0 ? (
                                <div className="manage-team-empty" style={{ padding: '36px 0', flexDirection: 'column' }}>
                                    <i className="fa fa-envelope-open" style={{ fontSize: '28px', color: '#cbd5e1' }}></i>
                                    <p style={{ margin: '8px 0 0', color: '#64748b' }}>
                                        No pending invitations for this project.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {projectInvitations.map((inv) => (
                                        <div key={inv.id} className="pending-invitation-row">
                                            <div className="pending-invitation-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <strong>{inv.recipient.name}</strong>
                                                    <span
                                                        className={`invitation-badge ${
                                                            inv.type === 'FACULTY_GUIDE' ? 'faculty' : ''
                                                        }`}
                                                    >
                                                        {inv.type === 'FACULTY_GUIDE' ? 'Faculty Guide' : 'Team Member'}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            color:
                                                                inv.status === 'ACCEPTED'
                                                                    ? '#059669'
                                                                    : inv.status === 'DECLINED'
                                                                    ? '#dc2626'
                                                                    : '#4f46e5',
                                                        }}
                                                    >
                                                        • {inv.status}
                                                    </span>
                                                </div>
                                                <span>{inv.recipient.email}</span>
                                                {inv.message && (
                                                    <span style={{ display: 'block', fontStyle: 'italic', marginTop: '2px', color: '#4b5563' }}>
                                                        "{inv.message}"
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                    Sent {new Date(inv.createdAt).toLocaleDateString()} by {inv.invitedBy.name}
                                                </span>
                                            </div>

                                            {inv.status === 'PENDING' && (isOwner || isAdmin) && (
                                                <button
                                                    type="button"
                                                    className="pending-invitation-cancel-btn"
                                                    onClick={() => handleCancelInvitation(inv.id)}
                                                    disabled={cancellingInviteId === inv.id}
                                                >
                                                    {cancellingInviteId === inv.id ? 'Cancelling...' : 'Cancel'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: CURRENT ROSTER / DIRECT ASSIGNMENT */}
                    {activeTab === 'current' && (
                        <div>
                            {/* Students */}
                            <div className="manage-team-section">
                                <div className="manage-team-section-header">
                                    <div>
                                        <h3>
                                            <i className="fa fa-graduation-cap"></i>
                                            Students
                                        </h3>
                                        <p>Enrolled team members working on this project.</p>
                                    </div>
                                    <span>{assignedStudents.length} Assigned</span>
                                </div>

                                <div className="manage-team-user-list">
                                    {isAdmin && students.length > 0 ? (
                                        students.map((student) => {
                                            const isSelected = selectedStudentIds.includes(student.id);
                                            return (
                                                <label
                                                    key={student.id}
                                                    className={`manage-team-user ${isSelected ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleStudentToggle(student.id)}
                                                    />
                                                    <div className="manage-team-user-avatar">
                                                        {student.name.charAt(0).toUpperCase()}
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
                                    ) : assignedStudents.length > 0 ? (
                                        assignedStudents.map((student) => (
                                            <div key={student.id} className="manage-team-user selected">
                                                <div className="manage-team-user-avatar">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="manage-team-user-info">
                                                    <strong>{student.name}</strong>
                                                    <span>{student.email}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="manage-team-empty">
                                            <i className="fa fa-graduation-cap"></i>
                                            <span>No students assigned yet.</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Faculty Guide */}
                            <div className="manage-team-section">
                                <div className="manage-team-section-header">
                                    <div>
                                        <h3>
                                            <i className="fa fa-chalkboard-teacher"></i>
                                            Faculty Guide / Supervisor
                                        </h3>
                                        <p>Academic supervisor overseeing project skill evaluations.</p>
                                    </div>
                                    <span>{assignedFaculty.length} Assigned</span>
                                </div>

                                <div className="manage-team-user-list">
                                    {isAdmin && faculty.length > 0 ? (
                                        faculty.map((f) => {
                                            const isSelected = selectedFacultyIds.includes(f.id);
                                            return (
                                                <label
                                                    key={f.id}
                                                    className={`manage-team-user ${isSelected ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleFacultyToggle(f.id)}
                                                    />
                                                    <div className="manage-team-user-avatar faculty">
                                                        {f.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="manage-team-user-info">
                                                        <strong>{f.name}</strong>
                                                        <span>{f.email}</span>
                                                    </div>
                                                    <div className="manage-team-check">
                                                        <i className="fa fa-check"></i>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    ) : assignedFaculty.length > 0 ? (
                                        assignedFaculty.map((f) => (
                                            <div key={f.id} className="manage-team-user selected">
                                                <div className="manage-team-user-avatar faculty">
                                                    {f.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="manage-team-user-info">
                                                    <strong>{f.name}</strong>
                                                    <span>{f.email}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="manage-team-empty">
                                            <i className="fa fa-chalkboard-teacher"></i>
                                            <span>No faculty supervisor assigned yet.</span>
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
                                        <p>System administrators with oversight access.</p>
                                    </div>
                                    <span>{assignedAdmins.length} Assigned</span>
                                </div>

                                <div className="manage-team-user-list">
                                    {isAdmin && admins.length > 0 ? (
                                        admins.map((admin) => {
                                            const isSelected = selectedAdminIds.includes(admin.id);
                                            return (
                                                <label
                                                    key={admin.id}
                                                    className={`manage-team-user ${isSelected ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleAdminToggle(admin.id)}
                                                    />
                                                    <div className="manage-team-user-avatar admin">
                                                        {admin.name.charAt(0).toUpperCase()}
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
                                    ) : assignedAdmins.length > 0 ? (
                                        assignedAdmins.map((admin) => (
                                            <div key={admin.id} className="manage-team-user selected">
                                                <div className="manage-team-user-avatar admin">
                                                    {admin.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="manage-team-user-info">
                                                    <strong>{admin.name}</strong>
                                                    <span>{admin.email}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="manage-team-empty">
                                            <i className="fa fa-shield-alt"></i>
                                            <span>No admins assigned.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="manage-team-modal-footer">
                    <button
                        type="button"
                        className="manage-team-cancel-button"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Close
                    </button>

                    {isAdmin && activeTab === 'current' && onSave && (
                        <button
                            type="button"
                            className="manage-team-save-button"
                            onClick={handleSaveDirect}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <i className="fa fa-spinner fa-spin"></i> Saving...
                                </>
                            ) : (
                                <>
                                    <i className="fa fa-check"></i> Save Team Assignments
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageTeamModal;
