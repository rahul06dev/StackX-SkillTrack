// src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage';
// ⚠️ NEW IMPORT
import ProjectBoardPage from './pages/ProjectBoardPage';
import Register from './pages/Register';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRedirect from './components/RoleRedirect';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProjectsPage from './pages/AdminProjectsPage';
import AdminSkillsPage from './pages/AdminSkillsPage';
import AdminJobRolesPage from './pages/AdminJobRolesPage';
import AdminTalentSearchPage from './pages/AdminTalentSearchPage';
import PortfolioPage from './pages/PortfolioPage';
import SettingsPage from './pages/SettingsPage';
import StudentSkillsPage from './pages/StudentSkillsPage';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminProjectsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/skills"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminSkillsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/job-roles"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminJobRolesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/talent-search"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminTalentSearchPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectBoardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/portfolio"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <PortfolioPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/skills"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentSkillsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/skills"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentSkillsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Public Shareable Digital Skill Passport / Portfolio */}
        <Route path="/portfolio/:studentId" element={<PortfolioPage isPublic />} />
        <Route path="/share/portfolio/:studentId" element={<PortfolioPage isPublic />} />

        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;