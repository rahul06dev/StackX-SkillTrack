import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../auth.css';

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  navigate('/');
};

  return (
   <button
  onClick={handleLogout}
  className="logout-button"
>
  Logout
</button>
  );
};

export default LogoutButton;