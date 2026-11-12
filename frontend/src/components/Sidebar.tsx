
import React from 'react';
import { Link } from 'react-router-dom';
import LogoutButton from './LogoutButton';

interface SidebarProps {
  activeTab?: 'dashboard' | 'projects' | 'skills' | 'job-roles' | 'talent-search';
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab = 'dashboard',
}) => {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isAdmin = user?.role === 'ADMIN';

  const getNavClass = (
    tabName: 'dashboard' | 'projects' | 'skills' | 'job-roles' | 'talent-search'
  ) =>
    tabName === activeTab
      ? 'skilltrack-nav-item active'
      : 'skilltrack-nav-item';

  const projectsPath = isAdmin ? '/admin/projects' : '/projects';

  return (
    <aside className="skilltrack-sidebar">
      <div>
        <div className="skilltrack-logo">
          <div className="skilltrack-logo-icon">
            <i className="fa fa-layer-group"></i>
          </div>
          <div>
            <h2>SkillTrack</h2>
            <p>StackX</p>
          </div>
        </div>

        <div className="skilltrack-nav-section">
          <p className="skilltrack-nav-title">Navigation</p>

          <nav>
            <Link
              to={
                isAdmin
                  ? '/admin'
                  : user?.role === 'FACULTY'
                  ? '/faculty'
                  : '/student'
              }
              className={getNavClass('dashboard')}
            >
              <i className="fa fa-th-large"></i>
              <span>Dashboard</span>
            </Link>

            <Link
              to={projectsPath}
              className={getNavClass('projects')}
            >
              <i className="fa fa-folder"></i>
              <span>Projects</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/admin/skills"
                  className={getNavClass('skills')}
                >
                  <i className="fa fa-award"></i>
                  <span>Skills Catalogue</span>
                </Link>

                <Link
                  to="/admin/job-roles"
                  className={getNavClass('job-roles')}
                >
                  <i className="fa fa-briefcase"></i>
                  <span>Job Roles</span>
                </Link>

                <Link
                  to="/admin/talent-search"
                  className={getNavClass('talent-search')}
                >
                  <i className="fa fa-search"></i>
                  <span>Talent Search</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="skilltrack-user-section">
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

        <LogoutButton />
      </div>
    </aside>
  );
};

export default Sidebar;
