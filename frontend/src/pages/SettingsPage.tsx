import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  headline: string | null;
  bio: string | null;
  department: string | null;
  studentIdNo: string | null;
  graduationYear: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  shareableSlug: string | null;
  createdAt: string;
}

interface NotificationPrefs {
  projectInvitations: boolean;
  taskAssignments: boolean;
  skillReviews: boolean;
  deadlineReminders: boolean;
  soundAlerts: boolean;
  emailFrequency: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'OFF';
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  projectInvitations: true,
  taskAssignments: true,
  skillReviews: true,
  deadlineReminders: true,
  soundAlerts: true,
  emailFrequency: 'INSTANT',
};

const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active tab: 'profile' | 'notifications' | 'security'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>(
    tabParam === 'notifications' || tabParam === 'security' ? tabParam : 'profile'
  );

  useEffect(() => {
    if (tabParam === 'notifications' || tabParam === 'security' || tabParam === 'profile') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'profile' | 'notifications' | 'security') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');
  const [studentIdNo, setStudentIdNo] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [shareableSlug, setShareableSlug] = useState('');

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Notification state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => {
    const saved = localStorage.getItem('skilltrack_notification_settings');
    if (saved) {
      try {
        return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_NOTIF_PREFS;
      }
    }
    return DEFAULT_NOTIF_PREFS;
  });
  const [notifSuccess, setNotifSuccess] = useState('');

  // ==========================================
  // Fetch Profile
  // ==========================================
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      setProfileError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load profile details.');
      }

      const data: UserProfile = await res.json();
      setProfile(data);
      setName(data.name || '');
      setHeadline(data.headline || '');
      setBio(data.bio || '');
      setDepartment(data.department || '');
      setStudentIdNo(data.studentIdNo || '');
      setGraduationYear(data.graduationYear || '');
      setGithubUrl(data.githubUrl || '');
      setLinkedinUrl(data.linkedinUrl || '');
      setShareableSlug(data.shareableSlug || '');
    } catch (err) {
      console.error('❌ Failed to fetch user profile:', err);
      setProfileError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ==========================================
  // Save Profile
  // ==========================================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setProfileSuccess('');
      setProfileError('');

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          department: department.trim() || null,
          studentIdNo: studentIdNo.trim() || null,
          graduationYear: graduationYear.trim() || null,
          githubUrl: githubUrl.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          shareableSlug: shareableSlug.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile.');
      }

      setProfile(data.user);
      setProfileSuccess('Profile details updated successfully.');

      // Update localStorage user object so sidebar immediately reflects new name
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem(
          'user',
          JSON.stringify({ ...u, name: data.user.name || name.trim() })
        );
      }
    } catch (err) {
      console.error('❌ Save profile error:', err);
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ==========================================
  // Delete Account (Self-Deletion)
  // ==========================================
  const handleConfirmDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      setDeleteError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete account.');
      }

      localStorage.removeItem('user');
      localStorage.removeItem('token');
      alert('Your account has been deleted successfully.');
      navigate('/');
    } catch (err) {
      console.error('❌ Delete account error:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.');
      setDeletingAccount(false);
    }
  };

  // ==========================================
  // Update Password
  // ==========================================
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password.');
      }

      setPasswordSuccess('Password successfully updated! Please keep your new credentials safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('❌ Update password error:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // ==========================================
  // Save Notification Preferences
  // ==========================================
  const handleTogglePref = (key: keyof NotificationPrefs) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('skilltrack_notification_settings', JSON.stringify(updated));
      return updated;
    });
    setNotifSuccess('Notification preference saved.');
    setTimeout(() => setNotifSuccess(''), 3000);
  };

  const handleChangeEmailFreq = (freq: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'OFF') => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, emailFrequency: freq };
      localStorage.setItem('skilltrack_notification_settings', JSON.stringify(updated));
      return updated;
    });
    setNotifSuccess('Email digest frequency updated.');
    setTimeout(() => setNotifSuccess(''), 3000);
  };

  // Password requirement checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="admin-page">
      <Sidebar activeTab="settings" />

      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div>
            <h1>Account & Settings</h1>
            <p>Manage your institutional profile, security credentials, and alert preferences.</p>
          </div>
        </header>

        {/* Tab Navigation Navigation Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '24px',
            paddingBottom: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange('profile')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'profile' ? '#4f46e5' : '#64748b',
              borderBottom: activeTab === 'profile' ? '2.5px solid #4f46e5' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fa fa-user-circle"></i>
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('notifications')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'notifications' ? '#4f46e5' : '#64748b',
              borderBottom:
                activeTab === 'notifications' ? '2.5px solid #4f46e5' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fa fa-bell"></i>
            <span>Notification Settings</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('security')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'security' ? '#4f46e5' : '#64748b',
              borderBottom:
                activeTab === 'security' ? '2.5px solid #4f46e5' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fa fa-shield-alt"></i>
            <span>Security & Password</span>
          </button>
        </div>

        {/* ========================================================
            TAB 1: PROFILE DETAILS
           ======================================================== */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: '840px' }}>
            {profileSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <i className="fa fa-check-circle"></i>
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <i className="fa fa-exclamation-circle"></i>
                <span>{profileError}</span>
              </div>
            )}

            {loadingProfile ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#6366f1' }}></i>
                <p style={{ marginTop: '12px', color: '#64748b' }}>Loading profile information...</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleSaveProfile}>
                {/* Profile Identity Card */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                    User Information
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {/* Full Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Full Name <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Institutional Email (Read-Only) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Institutional Email <span style={{ fontSize: '11px', color: '#059669' }}>● Verified</span>
                      </label>
                      <input
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#64748b',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          cursor: 'not-allowed',
                        }}
                      />
                    </div>

                    {/* Security Role (Read-Only Badge) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Security Role
                      </label>
                      <div
                        style={{
                          padding: '9px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#334155',
                          fontSize: '14px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <i
                          className={`fa ${
                            profile?.role === 'ADMIN'
                              ? 'fa-user-shield'
                              : profile?.role === 'FACULTY'
                              ? 'fa-chalkboard-teacher'
                              : 'fa-graduation-cap'
                          }`}
                          style={{
                            color:
                              profile?.role === 'ADMIN'
                                ? '#7c3aed'
                                : profile?.role === 'FACULTY'
                                ? '#059669'
                                : '#2563eb',
                          }}
                        ></i>
                        <span>{profile?.role}</span>
                      </div>
                    </div>

                    {/* Department */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Department / Branch
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Computer Science and Engineering"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Academic & Professional Portfolio Details */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    marginBottom: '24px',
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                    Academic & Passport Profile
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Headline */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Headline / Role Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Full-Stack Developer | Cloud Architecture & Distributed Systems"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Professional Bio / Summary
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Brief summary of your academic journey, technical strengths, and project experiences..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                      {/* Student / Faculty ID */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          University Roll / ID No
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2023-CS-104"
                          value={studentIdNo}
                          onChange={(e) => setStudentIdNo(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Graduation Year */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Graduation Year / Batch
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2026"
                          value={graduationYear}
                          onChange={(e) => setGraduationYear(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* GitHub URL */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          GitHub Profile URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://github.com/username"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* LinkedIn URL */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          LinkedIn Profile URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://linkedin.com/in/username"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    {/* Public Slug */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Shareable Portfolio Slug
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span
                          style={{
                            padding: '10px 12px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRight: 'none',
                            borderRadius: '8px 0 0 8px',
                            fontSize: '13px',
                            color: '#64748b',
                          }}
                        >
                          /portfolio/
                        </span>
                        <input
                          type="text"
                          placeholder="your-custom-slug"
                          value={shareableSlug}
                          onChange={(e) => setShareableSlug(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '0 8px 8px 0',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="admin-skills-add-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {savingProfile ? (
                      <i className="fa fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa fa-save"></i>
                    )}
                    <span>Save Profile Changes</span>
                  </button>
                </div>
              </form>

              {/* Danger Zone: Delete Account */}
              <div
                style={{
                  marginTop: '36px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #fee2e2',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa fa-exclamation-triangle"></i>
                      <span>Delete Account</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Permanently delete your account, project memberships, and skill passport records. This action cannot be undone.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setShowDeleteModal(true);
                    }}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 18px',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className="fa fa-trash-alt"></i>
                    <span>Delete My Account</span>
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        )}

        {/* ========================================================
            TAB 2: NOTIFICATION SETTINGS
           ======================================================== */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '840px' }}>
            {notifSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <i className="fa fa-check-circle"></i>
                <span>{notifSuccess}</span>
              </div>
            )}

            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>
                In-App Notification Preferences
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                Control which activity triggers real-time notification drawer updates and unread count badges.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Preference 1 */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      <i className="fa fa-user-plus" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                      Project Team & Faculty Invitations
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Alerts when invited to collaborate on projects or when a faculty guide accepts supervision.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.projectInvitations}
                    onChange={() => handleTogglePref('projectInvitations')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                  />
                </label>

                {/* Preference 2 */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      <i className="fa fa-tasks" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                      Task Assignments & Status Transitions
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Alerts when tasks are assigned to you or moved to In Review or Done on the Kanban board.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.taskAssignments}
                    onChange={() => handleTogglePref('taskAssignments')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                  />
                </label>

                {/* Preference 3 */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      <i className="fa fa-award" style={{ color: '#059669', marginRight: '8px' }}></i>
                      Skill Passport Reviews & Endorsements
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Alerts when faculty verifies, endorses, or requests revision for submitted skill claims.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.skillReviews}
                    onChange={() => handleTogglePref('skillReviews')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                  />
                </label>

                {/* Preference 4 */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      <i className="fa fa-calendar-alt" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
                      Milestone & Deadline Reminders
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Upcoming due dates for sprint tasks, project submissions, and evaluation milestones.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.deadlineReminders}
                    onChange={() => handleTogglePref('deadlineReminders')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                  />
                </label>

                {/* Preference 5 */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                      <i className="fa fa-volume-up" style={{ color: '#7c3aed', marginRight: '8px' }}></i>
                      Sound Alerts
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Play an audio cue when a high-priority notification arrives while in the workspace.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.soundAlerts}
                    onChange={() => handleTogglePref('soundAlerts')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                  />
                </label>
              </div>
            </div>

            {/* Email Digest Card */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>
                Institutional Email Digest
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Select how frequently you receive email updates sent to your registered institutional email.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                  { value: 'INSTANT', label: 'Instant Delivery', desc: 'Real-time emails as events occur' },
                  { value: 'DAILY', label: 'Daily Digest', desc: 'Single summary at 08:00 AM' },
                  { value: 'WEEKLY', label: 'Weekly Summary', desc: 'Summary every Monday morning' },
                  { value: 'OFF', label: 'Mute Emails', desc: 'Only critical security alerts' },
                ].map((item) => (
                  <div
                    key={item.value}
                    onClick={() => handleChangeEmailFreq(item.value as any)}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${notifPrefs.emailFrequency === item.value ? '#4f46e5' : '#e2e8f0'}`,
                      background: notifPrefs.emailFrequency === item.value ? '#eef2ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: SECURITY & PASSWORD
           ======================================================== */}
        {activeTab === 'security' && (
          <div style={{ maxWidth: '640px' }}>
            {passwordSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <i className="fa fa-check-circle"></i>
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <i className="fa fa-exclamation-circle"></i>
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword}>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
                  marginBottom: '24px',
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>
                  Update Password
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Change your password to keep your academic credentials secure. Password must meet OWASP security guidelines.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Current Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Current Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        placeholder="Enter current password"
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        <i className={`fa ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      New Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="Enter new strong password"
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        <i className={`fa ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Password Checklist */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                      Password Strength Requirements:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                      <div style={{ color: hasMinLength ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${hasMinLength ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        At least 8 characters
                      </div>
                      <div style={{ color: hasUppercase ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${hasUppercase ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        One uppercase letter (A-Z)
                      </div>
                      <div style={{ color: hasLowercase ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${hasLowercase ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        One lowercase letter (a-z)
                      </div>
                      <div style={{ color: hasNumber ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${hasNumber ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        One numerical digit (0-9)
                      </div>
                      <div style={{ color: hasSpecial ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${hasSpecial ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        One special character (!@#$)
                      </div>
                      <div style={{ color: passwordsMatch ? '#059669' : '#94a3b8' }}>
                        <i className={`fa ${passwordsMatch ? 'fa-check-circle' : 'fa-circle'}`} style={{ marginRight: '6px' }}></i>
                        Passwords match
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={
                      savingPassword ||
                      !hasMinLength ||
                      !hasUppercase ||
                      !hasLowercase ||
                      !hasNumber ||
                      !hasSpecial ||
                      !passwordsMatch
                    }
                    className="admin-skills-add-button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity:
                        !hasMinLength ||
                        !hasUppercase ||
                        !hasLowercase ||
                        !hasNumber ||
                        !hasSpecial ||
                        !passwordsMatch
                          ? 0.6
                          : 1,
                      cursor:
                        !hasMinLength ||
                        !hasUppercase ||
                        !hasLowercase ||
                        !hasNumber ||
                        !hasSpecial ||
                        !passwordsMatch
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {savingPassword ? (
                      <i className="fa fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa fa-key"></i>
                    )}
                    <span>Update Password</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Session & Sign Out Card */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #fee2e2',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#991b1b' }}>
                    Active Session & Sign Out
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Sign out of your account on this device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa fa-sign-out-alt"></i>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================
            ACCOUNT DELETION CONFIRMATION MODAL
           ======================================================== */}
        {showDeleteModal && (
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
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>Delete Account Confirmation</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#b91c1c' }}>
                    Permanent & irreversible action
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '22px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete your account (<strong>{profile?.email}</strong>)?
                </p>
                <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  All your registered project enrollments, tasks, comments, and verified skill passport claims will be permanently wiped out.
                </p>

                {deleteError && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fa fa-exclamation-circle"></i>
                    <span>{deleteError}</span>
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
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteError('');
                  }}
                  disabled={deletingAccount}
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
                  onClick={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: deletingAccount ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {deletingAccount && <i className="fa fa-spinner fa-spin"></i>}
                  <span>Yes, Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsPage;

