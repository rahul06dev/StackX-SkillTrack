import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      // Store authentication data
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      // Redirect based on role
      if (data.user.role === 'STUDENT') {
        navigate('/student');
      } else if (data.user.role === 'FACULTY') {
        navigate('/faculty');
      } else if (data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            <i className="fa fa-layer-group"></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
              SkillTrack
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              StackX Academic Suite
            </p>
          </div>
        </div>

        <p className="auth-description">
          Sign in to access your projects, competencies, and digital skill passport.
        </p>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="auth-field">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@institution.edu"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px 6px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error">
              <i className="fa fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-secondary">
          <button type="button" onClick={() => navigate('/register')}>
            Don't have an account? <strong>Sign up as a Student</strong>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
