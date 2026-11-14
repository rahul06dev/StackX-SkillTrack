import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  department: string | null;
  headline: string | null;
  createdAt: string;
}

type RoleFilter = 'ALL' | 'STUDENT' | 'FACULTY' | 'ADMIN';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Role modification modal / inline state
  const [targetUser, setTargetUser] = useState<UserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'FACULTY' | 'ADMIN'>('STUDENT');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User deletion modal state
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Current logged in user info
  const currentUserRaw = localStorage.getItem('user');
  const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;

  // ==========================================
  // Fetch All Users
  // ==========================================
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required.');
      }

      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to fetch users (${res.status})`);
      }

      const data: UserRecord[] = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('❌ Failed to fetch user roster:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Clear toast after 4 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // ==========================================
  // Role Mutation Handler
  // ==========================================
  const handleOpenRoleModal = (user: UserRecord) => {
    setTargetUser(user);
    setSelectedRole(user.role);
  };

  const handleCloseRoleModal = () => {
    setTargetUser(null);
    setUpdatingRole(false);
  };

  const handleConfirmRoleChange = async () => {
    if (!targetUser) return;
    if (targetUser.role === selectedRole) {
      handleCloseRoleModal();
      return;
    }

    try {
      setUpdatingRole(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user role.');
      }

      // Update user in local state
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: selectedRole } : u))
      );

      setActionMessage({
        type: 'success',
        text: `Role for "${targetUser.name}" successfully updated to ${selectedRole}.`,
      });
      handleCloseRoleModal();
    } catch (err) {
      console.error('❌ Role update error:', err);
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update user role.',
      });
      setUpdatingRole(false);
    }
  };

  // ==========================================
  // User Deletion Handlers
  // ==========================================
  const handleOpenDeleteModal = (user: UserRecord) => {
    setUserToDelete(user);
  };

  const handleCloseDeleteModal = () => {
    setUserToDelete(null);
    setDeletingUser(false);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeletingUser(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user.');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setActionMessage({
        type: 'success',
        text: `User ${userToDelete.name} (${userToDelete.email}) was permanently deleted.`,
      });
      handleCloseDeleteModal();
    } catch (err) {
      console.error('❌ Delete user error:', err);
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete user.',
      });
      setDeletingUser(false);
    }
  };

  // ==========================================
  // Derived Filtering and Metrics
  // ==========================================
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department && u.department.trim()) {
        set.add(u.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [users]);

  const metrics = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((u) => u.role === 'STUDENT').length,
      faculty: users.filter((u) => u.role === 'FACULTY').length,
      admins: users.filter((u) => u.role === 'ADMIN').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      // Role filter
      if (roleFilter !== 'ALL' && user.role !== roleFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== 'ALL') {
        if (!user.department || user.department.trim() !== departmentFilter) {
          return false;
        }
      }

      // Search match
      if (!q) return true;
      const matchName = user.name.toLowerCase().includes(q);
      const matchEmail = user.email.toLowerCase().includes(q);
      const matchDept = user.department?.toLowerCase().includes(q);
      const matchHeadline = user.headline?.toLowerCase().includes(q);

      return matchName || matchEmail || matchDept || matchHeadline;
    });
  }, [users, searchTerm, roleFilter, departmentFilter]);

  const getRoleBadgeClass = (role: 'STUDENT' | 'FACULTY' | 'ADMIN') => {
    switch (role) {
      case 'ADMIN':
        return 'role-badge-admin';
      case 'FACULTY':
        return 'role-badge-faculty';
      case 'STUDENT':
      default:
        return 'role-badge-student';
    }
  };

  const getRoleIcon = (role: 'STUDENT' | 'FACULTY' | 'ADMIN') => {
    switch (role) {
      case 'ADMIN':
        return 'fa-user-shield';
      case 'FACULTY':
        return 'fa-chalkboard-teacher';
      case 'STUDENT':
      default:
        return 'fa-graduation-cap';
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="admin-page">
      <Sidebar activeTab="users" />

      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div>
            <h1>User Management</h1>
            <p>University-wide user roster, institutional identities, and role governance.</p>
          </div>
          <button
            type="button"
            className="admin-skills-add-button secondary"
            onClick={fetchUsers}
            title="Refresh Roster"
          >
            <i className={`fa fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>
        </header>

        {/* Toast / Notification Banner */}
        {actionMessage && (
          <div
            className={`admin-users-toast ${actionMessage.type}`}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: 500,
              fontSize: '14px',
              background: actionMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: actionMessage.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${actionMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            <i
              className={`fa ${
                actionMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'
              }`}
            ></i>
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Metric Overview Cards */}
        <div
          className="admin-users-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            className="admin-metric-card"
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  Total Users
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '26px', color: '#0f172a' }}>
                  {metrics.total}
                </h3>
              </div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fa fa-users"></i>
              </div>
            </div>
          </div>

          <div
            className="admin-metric-card"
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  Students Enrolled
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '26px', color: '#2563eb' }}>
                  {metrics.students}
                </h3>
              </div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fa fa-graduation-cap"></i>
              </div>
            </div>
          </div>

          <div
            className="admin-metric-card"
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  Faculty Guides
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '26px', color: '#059669' }}>
                  {metrics.faculty}
                </h3>
              </div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fa fa-chalkboard-teacher"></i>
              </div>
            </div>
          </div>

          <div
            className="admin-metric-card"
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                  Administrators
                </p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '26px', color: '#7c3aed' }}>
                  {metrics.admins}
                </h3>
              </div>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fa fa-user-shield"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <section className="admin-section" style={{ marginBottom: '24px' }}>
          <div
            className="admin-users-controls"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Search Box */}
            <div
              className="admin-skills-search"
              style={{ flex: '1 1 280px', minWidth: '220px', maxWidth: '420px', margin: 0 }}
            >
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Search by name, institutional email, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '4px',
                  }}
                  title="Clear search"
                >
                  <i className="fa fa-times"></i>
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Role Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Role:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#1e293b',
                    background: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Roles ({metrics.total})</option>
                  <option value="STUDENT">Students ({metrics.students})</option>
                  <option value="FACULTY">Faculty ({metrics.faculty})</option>
                  <option value="ADMIN">Admins ({metrics.admins})</option>
                </select>
              </div>

              {/* Department Filter */}
              {departments.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                    Dept:
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#1e293b',
                      background: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Filters */}
              {(searchTerm || roleFilter !== 'ALL' || departmentFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('ALL');
                    setDepartmentFilter('ALL');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Users Table / Content */}
        <section
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <i
                className="fa fa-spinner fa-spin"
                style={{ fontSize: '32px', color: '#6366f1', marginBottom: '16px' }}
              ></i>
              <h3 style={{ margin: 0, color: '#334155' }}>Loading user roster...</h3>
              <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                Fetching university accounts and authorization profiles.
              </p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <i
                className="fa fa-exclamation-triangle"
                style={{ fontSize: '32px', color: '#ef4444', marginBottom: '16px' }}
              ></i>
              <h3 style={{ margin: 0, color: '#991b1b' }}>Failed to load users</h3>
              <p style={{ margin: '8px 0 16px 0', color: '#64748b' }}>{error}</p>
              <button
                type="button"
                className="admin-skills-add-button"
                onClick={fetchUsers}
                style={{ display: 'inline-flex' }}
              >
                Try Again
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '28px',
                  background: '#f1f5f9',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  margin: '0 auto 16px auto',
                }}
              >
                <i className="fa fa-user-slash"></i>
              </div>
              <h3 style={{ margin: 0, color: '#334155' }}>No users found</h3>
              <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                {searchTerm || roleFilter !== 'ALL' || departmentFilter !== 'ALL'
                  ? 'No users match your active filter criteria.'
                  : 'There are currently no registered users in the database.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="talent-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      User Details
                    </th>
                    <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      Institutional Email
                    </th>
                    <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      Department
                    </th>
                    <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      Role
                    </th>
                    <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      Joined
                    </th>
                    <th style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                      Governance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isSelf = currentUser?.id === user.id;

                    return (
                      <tr
                        key={user.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Name and Avatar */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background:
                                  user.role === 'ADMIN'
                                    ? '#ede9fe'
                                    : user.role === 'FACULTY'
                                    ? '#d1fae5'
                                    : '#dbeafe',
                                color:
                                  user.role === 'ADMIN'
                                    ? '#6d28d9'
                                    : user.role === 'FACULTY'
                                    ? '#047857'
                                    : '#1d4ed8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  fontSize: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                              </div>
                              {user.headline && (
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                  {user.headline}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Institutional Email */}
                        <td style={{ padding: '12px 18px', color: '#334155', fontSize: '13px' }}>
                          <code
                            style={{
                              fontFamily: 'monospace',
                              background: '#f1f5f9',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#334155',
                            }}
                          >
                            {user.email}
                          </code>
                        </td>

                        {/* Department */}
                        <td style={{ padding: '12px 18px', color: '#475569', fontSize: '13px' }}>
                          {user.department ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#334155',
                              }}
                            >
                              <i className="fa fa-building" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
                              {user.department}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                              Not specified
                            </span>
                          )}
                        </td>

                        {/* Role Badge */}
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            className={getRoleBadgeClass(user.role)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background:
                                user.role === 'ADMIN'
                                  ? '#f5f3ff'
                                  : user.role === 'FACULTY'
                                  ? '#ecfdf5'
                                  : '#eff6ff',
                              color:
                                user.role === 'ADMIN'
                                  ? '#7c3aed'
                                  : user.role === 'FACULTY'
                                  ? '#059669'
                                  : '#2563eb',
                              border: `1px solid ${
                                user.role === 'ADMIN'
                                  ? '#ddd6fe'
                                  : user.role === 'FACULTY'
                                  ? '#a7f3d0'
                                  : '#bfdbfe'
                              }`,
                            }}
                          >
                            <i className={`fa ${getRoleIcon(user.role)}`}></i>
                            {user.role}
                          </span>
                        </td>

                        {/* Joined Date */}
                        <td style={{ padding: '12px 18px', color: '#64748b', fontSize: '13px' }}>
                          {new Date(user.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        {/* Governance Actions */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenRoleModal(user)}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#6366f1';
                                e.currentTarget.style.color = '#4f46e5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.color = '#334155';
                              }}
                            >
                              <i className="fa fa-user-cog"></i>
                              Change Role
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(user)}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fef2f2';
                                e.currentTarget.style.borderColor = '#f87171';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                              title="Delete user permanently"
                            >
                              <i className="fa fa-trash-alt"></i>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer Count */}
          {!loading && !error && filteredUsers.length > 0 && (
            <div
              style={{
                padding: '12px 18px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                color: '#64748b',
              }}
            >
              <span>
                Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
              </span>
              <span>StackX Access Governance</span>
            </div>
          )}
        </section>

        {/* ========================================================
            ROLE CHANGE MODAL
           ======================================================== */}
        {targetUser && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              className="modal-container"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '460px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 22px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#ede9fe',
                      color: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                    }}
                  >
                    <i className="fa fa-user-shield"></i>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                    Role Governance
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseRoleModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa fa-times"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '22px' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#475569' }}>
                  Assign a new security role for <strong>{targetUser.name}</strong> (
                  <code style={{ fontSize: '12px' }}>{targetUser.email}</code>).
                </p>

                {currentUser?.id === targetUser.id && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#b45309',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fa fa-exclamation-triangle"></i>
                    <span>
                      <strong>Warning:</strong> You are editing your own administrator role.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Option: Student */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${selectedRole === 'STUDENT' ? '#2563eb' : '#e2e8f0'}`,
                      background: selectedRole === 'STUDENT' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="STUDENT"
                      checked={selectedRole === 'STUDENT'}
                      onChange={() => setSelectedRole('STUDENT')}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                        <i className="fa fa-graduation-cap" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                        STUDENT
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Can join project teams, execute tasks, and submit verified skill claims.
                      </div>
                    </div>
                  </label>

                  {/* Option: Faculty */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${selectedRole === 'FACULTY' ? '#059669' : '#e2e8f0'}`,
                      background: selectedRole === 'FACULTY' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="FACULTY"
                      checked={selectedRole === 'FACULTY'}
                      onChange={() => setSelectedRole('FACULTY')}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                        <i className="fa fa-chalkboard-teacher" style={{ color: '#059669', marginRight: '6px' }}></i>
                        FACULTY
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Can guide student projects, review task deliverables, and endorse skill passport claims.
                      </div>
                    </div>
                  </label>

                  {/* Option: Admin */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${selectedRole === 'ADMIN' ? '#7c3aed' : '#e2e8f0'}`,
                      background: selectedRole === 'ADMIN' ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="ADMIN"
                      checked={selectedRole === 'ADMIN'}
                      onChange={() => setSelectedRole('ADMIN')}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                        <i className="fa fa-user-shield" style={{ color: '#7c3aed', marginRight: '6px' }}></i>
                        ADMIN
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Full administrative access: user governance, master skill catalogue, job roles, and talent search.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 22px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseRoleModal}
                  disabled={updatingRole}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRoleChange}
                  disabled={updatingRole || targetUser.role === selectedRole}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#4f46e5',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: updatingRole || targetUser.role === selectedRole ? 'not-allowed' : 'pointer',
                    opacity: updatingRole || targetUser.role === selectedRole ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {updatingRole && <i className="fa fa-spinner fa-spin"></i>}
                  <span>Save Role</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================
            DELETE CONFIRMATION MODAL
           ======================================================== */}
        {userToDelete && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              className="modal-container"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 22px',
                  borderBottom: '1px solid #fee2e2',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  <i className="fa fa-exclamation-triangle"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>Delete User Account</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#b91c1c' }}>
                    Institutional roster deletion
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '22px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete user <strong>{userToDelete.name}</strong> (
                  <code style={{ fontSize: '12px' }}>{userToDelete.email}</code>)?
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  All project memberships, skill passport submissions, and access privileges will be permanently removed.
                </p>

                {currentUser?.id === userToDelete.id && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#b45309',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fa fa-exclamation-triangle"></i>
                    <span>
                      <strong>Warning:</strong> You are about to delete your own logged-in administrator account.
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 22px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={deletingUser}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={deletingUser}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: deletingUser ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {deletingUser && <i className="fa fa-spinner fa-spin"></i>}
                  <span>Yes, Delete User</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminUsersPage;

