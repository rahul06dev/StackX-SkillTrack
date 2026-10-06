import React from 'react';
import { Navigate } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';

const RoleRedirect = () => {
  const userData = localStorage.getItem('user');

  // No logged-in user → show landing page
  if (!userData) {
    return <LandingPage />;
  }

  const user = JSON.parse(userData);

  // Logged-in user → redirect based on role
  if (user.role === 'STUDENT') {
    return <Navigate to="/student" replace />;
  }

  if (user.role === 'FACULTY') {
    return <Navigate to="/faculty" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  // Unknown/invalid role
  localStorage.removeItem('user');
  return <LandingPage />;
};

export default RoleRedirect;