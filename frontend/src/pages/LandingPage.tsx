import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../auth.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        'http://localhost:4300/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      if (data.user.role === 'STUDENT') {
        navigate('/student');
      } else if (data.user.role === 'FACULTY') {
        navigate('/faculty');
      } else if (data.user.role === 'ADMIN') {
        navigate('/admin');
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">

        <div className="landing-content">
          <h1>SkillTrack</h1>

          <h2>Track Skills. Manage Projects. Build Progress.</h2>

          <p>
            A centralized platform for students, faculty, and administrators
            to manage projects, track progress, and build meaningful skill
            profiles.
          </p>
        </div>

        <div className="auth-container">
          <h2>Welcome Back</h2>

          <p className="auth-description">
            Sign in to access your SkillTrack workspace.
          </p>

          <form onSubmit={handleLogin} className="auth-form">

            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

          </form>

          <div className="auth-secondary">
            <button onClick={() => navigate('/register')}>
              Don't have an account? Create one
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;