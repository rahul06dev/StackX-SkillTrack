import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');

    // Client-side validation: OWASP password complexity requirement
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain uppercase letters, lowercase letters, and at least one number.');
      return;
    }

    setLoading(true);

    try {
      // Role is omitted from payload (OWASP A01: Broken Access Control Prevention)
      // Public registration automatically creates a verified STUDENT profile.
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department.trim() || undefined,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (data.errors && data.errors[0]) || 'Registration failed.');
      }

      // Automatically log in the newly registered user
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      // Redirect based on role (always student for public registration)
      navigate('/student');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">

        <h1>Create Account</h1>

        <p className="auth-description">
          Create your student account to track projects and build your verified skill passport.
        </p>

        <form onSubmit={handleRegister} className="auth-form">

          <div className="auth-field">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Soham Hudge"
              required
            />
          </div>

          <div className="auth-field">
            <label>Institutional Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@mitaoe.ac.in"
              required
            />
          </div>

          <div className="auth-field">
            <label>Department / Branch</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                background: '#ffffff',
                color: '#1e293b',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select Department / Branch...</option>
              <option value="Computer Science and Engineering">Computer Science and Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Artificial Intelligence and Data Science">Artificial Intelligence and Data Science</option>
              <option value="Electronics and Communication Engineering">Electronics and Communication Engineering</option>
              <option value="Electrical and Electronics Engineering">Electrical and Electronics Engineering</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Civil Engineering">Civil Engineering</option>
              <option value="Chemical Engineering">Chemical Engineering</option>
              <option value="Aerospace Engineering">Aerospace Engineering</option>
              <option value="General Studies / First Year">General Studies / First Year</option>
            </select>
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 chars, uppercase, lowercase, number & symbol"
              required
            />
            <small className="text-xs text-gray-500 mt-1 block">
              Must be at least 8 characters with uppercase, lowercase, numbers, and symbols.
            </small>
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

        </form>

        <div className="auth-secondary">
          <button onClick={() => navigate('/')}>
            Already have an account? Login
          </button>
        </div>

      </div>
    </div>
  );
};

export default Register;
