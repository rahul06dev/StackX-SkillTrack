import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';

interface SidebarProps {
  activeTab?: 'dashboard' | 'projects' | 'skills' | 'job-roles' | 'talent-search' | 'portfolio' | 'users' | 'settings';
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab = 'dashboard',
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isAdmin = user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';

  // Automatically close drawer when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const getNavClass = (
    tabName: 'dashboard' | 'projects' | 'skills' | 'job-roles' | 'talent-search' | 'portfolio' | 'users' | 'settings'
  ) =>
    tabName === activeTab
      ? 'skilltrack-nav-item active'
      : 'skilltrack-nav-item';

  const projectsPath = isAdmin ? '/admin/projects' : '/projects';

  const dashboardPath = isAdmin
    ? '/admin'
    : user?.role === 'FACULTY'
    ? '/faculty'
    : '/student';

  return (
    <>
      {/* Mobile Sticky Header Bar (Visible on mobile/tablet <= 768px) */}
      <header className="skilltrack-mobile-header">
        <Link to={dashboardPath} className="skilltrack-mobile-brand">
          <div className="skilltrack-logo-icon">
            <i className="fa fa-layer-group"></i>
          </div>
          <div className="skilltrack-mobile-brand-text">
            <h2 className="skilltrack-mobile-title">SkillTrack</h2>
            <span className="skilltrack-mobile-subtitle">StackX</span>
          </div>
        </Link>

        <div className="skilltrack-mobile-actions">
          <NotificationBell />
          <button
            type="button"
            className="skilltrack-mobile-hamburger"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileOpen}
          >
            <i className={`fa ${isMobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="skilltrack-mobile-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar: Sticky on Desktop, Slide-out Drawer on Mobile */}
      <aside className={`skilltrack-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="skilltrack-sidebar-nav-container">
          <div className="skilltrack-logo">
            <div className="skilltrack-logo-icon">
              <i className="fa fa-layer-group"></i>
            </div>
            <div>
              <h2>SkillTrack</h2>
              <p>StackX</p>
            </div>
            <button
              type="button"
              className="skilltrack-mobile-close-btn"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close navigation menu"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>

          <div className="skilltrack-nav-section">
            <p className="skilltrack-nav-title">Navigation</p>

            <nav>
              <Link
                to={dashboardPath}
                className={getNavClass('dashboard')}
                onClick={() => setIsMobileOpen(false)}
              >
                <i className="fa fa-th-large"></i>
                <span>Dashboard</span>
              </Link>

              <Link
                to={projectsPath}
                className={getNavClass('projects')}
                onClick={() => setIsMobileOpen(false)}
              >
                <i className="fa fa-folder"></i>
                <span>Projects</span>
              </Link>

              {isAdmin && (
                <>
                  <Link
                    to="/admin/users"
                    className={getNavClass('users')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-users"></i>
                    <span>Users Roster</span>
                  </Link>

                  <Link
                    to="/admin/skills"
                    className={getNavClass('skills')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-award"></i>
                    <span>Skills Catalogue</span>
                  </Link>

                  <Link
                    to="/admin/job-roles"
                    className={getNavClass('job-roles')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-briefcase"></i>
                    <span>Job Roles</span>
                  </Link>

                  <Link
                    to="/admin/talent-search"
                    className={getNavClass('talent-search')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-search"></i>
                    <span>Talent Search</span>
                  </Link>
                </>
              )}

              {isStudent && (
                <>
                  <Link
                    to="/student/skills"
                    className={getNavClass('skills')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-award"></i>
                    <span>Your Skills</span>
                  </Link>

                  <Link
                    to="/student/portfolio"
                    className={getNavClass('portfolio')}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <i className="fa fa-id-badge"></i>
                    <span>Portfolio</span>
                  </Link>
                </>
              )}

              <Link
                to="/settings"
                className={getNavClass('settings')}
                onClick={() => setIsMobileOpen(false)}
              >
                <i className="fa fa-cog"></i>
                <span>Settings</span>
              </Link>
            </nav>
          </div>
        </div>

        <div className="skilltrack-user-section sticky-bottom-left">
          {/* User Profile Card - Static Display */}
          <div className="skilltrack-user">
            <div className="skilltrack-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="skilltrack-user-info">
              <span className="skilltrack-user-name">
                {user?.name || 'User'}
              </span>
              <span className="skilltrack-user-role">
                {user?.role || 'User'}
              </span>
            </div>
          </div>

          {/* Logout at the end */}
          <LogoutButton />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
