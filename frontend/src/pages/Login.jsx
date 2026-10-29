import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Scale,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LegalIllustration from '../components/LegalIllustration';
import InfoModal from '../components/InfoModal';
import { apiUrl, safeParseResponse } from '../utils/api';
import '../styles/Login.css';

/**
 * Login Page - Stage 4
 * --------------------
 * Features:
 * - Integrates with Flask /api/auth/login endpoint.
 * - Server-side authentication and session cookie setup.
 * - Role-based navigation to Advocate, Staff, or Client dashboard upon success.
 * - Generic error messaging for failed credentials or inactive accounts.
 * - Live backend /api/health indicator.
 */
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form input state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation & feedback state
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Backend Health Status State
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Checking System Status...',
  });

  // Modal dialog state
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // If already authenticated, redirect to role-specific dashboard
  useEffect(() => {
    if (user && user.role) {
      const targetRole = user.role.toLowerCase();
      const defaultRoleRoute = `/${targetRole}/dashboard`;
      const from = location.state?.from?.pathname;

      if (from && from !== '/login' && from !== '/forbidden' && from.startsWith(`/${targetRole}/`)) {
        navigate(from, { replace: true });
      } else {
        navigate(defaultRoleRoute, { replace: true });
      }
    }
  }, [user, navigate, location]);

  // Check Flask Backend Health on component mount
  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const response = await fetch(apiUrl('/api/health'));
        if (response.ok) {
          const data = await safeParseResponse(response);
          if (isMounted) {
            const dbConnected = data.database?.connected;
            setBackendHealth({
              status: 'online',
              message: dbConnected
                ? `Legal System Online & Secure`
                : `Legal System Online`,
            });
          }
        } else {
          if (isMounted) {
            setBackendHealth({
              status: 'offline',
              message: 'System service temporarily unavailable.',
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setBackendHealth({
            status: 'offline',
            message: 'Firm portal currently unreachable. Please check connection.',
          });
        }
      }
    }

    checkHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Standard Email validation helper
  const isValidEmail = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val.trim());
  };

  // Form Submission Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');

    const newErrors = { email: '', password: '' };
    let hasError = false;

    // 1. Email field validation
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
      hasError = true;
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address (e.g., advocate@example.com).';
      hasError = true;
    }

    // 2. Password field validation
    if (!password) {
      newErrors.password = 'Password is required.';
      hasError = true;
    }

    setErrors(newErrors);

    if (hasError) {
      return;
    }

    // 3. Submit to Flask Authentication API
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success && result.user) {
      // Navigate to role-specific dashboard based on server-verified role
      const roleRoute = `/${result.user.role.toLowerCase()}/dashboard`;
      navigate(roleRoute, { replace: true });
    } else {
      setAuthError(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

  // Modal open helpers
  const openModal = (title, message, type = 'info') => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="login-page-container">
      {/* 1. HEADER */}
      <header className="login-header" role="banner">
        <div className="header-inner">
          <Link to="/" className="brand-wrapper" title="Legal CaseBook Home">
            <div className="brand-icon-wrapper" aria-hidden="true">
              <Scale size={22} strokeWidth={2.2} />
            </div>
            <h1 className="brand-title">Legal CaseBook</h1>
          </Link>

          <div className="workspace-badge">
            <ShieldCheck size={16} className="workspace-badge-icon" aria-hidden="true" />
            <span>Secure Legal Workspace</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT (Left Section & Right Section) */}
      <main className="login-main" role="main">
        <div className="login-content-grid">
          {/* LEFT SECTION */}
          <section className="left-section" aria-labelledby="hero-heading">
            <h2 id="hero-heading" className="left-headline">
              Your cases.{' '}
              <span className="gold-text">Organized with confidence.</span>
            </h2>

            <p className="left-description">
              A secure workspace for advocates, legal staff, and clients. Manage
              hearings, track legal precedents, and coordinate filings in one place.
            </p>

            <div className="trust-badges" aria-label="Key platform assurances">
              <span className="trust-badge-item">
                <span className="gold-bullet"></span> Advocate Privacy
              </span>
              <span className="trust-badge-item">
                <span className="gold-bullet"></span> End-to-End Encryption
              </span>
              <span className="trust-badge-item">
                <span className="gold-bullet"></span> Role-Based Access
              </span>
            </div>

            {/* Subtle Legal-Themed Vector Illustration */}
            <div className="illustration-container">
              <LegalIllustration />
            </div>
          </section>

          {/* RIGHT SECTION (Login Card) */}
          <section className="right-section" aria-labelledby="form-title">
            <div className="login-card">
              <div className="card-header">
                <h3 id="form-title" className="card-title">Welcome back</h3>
                <p className="card-subtitle">Sign in to continue to your workspace.</p>
              </div>

              {/* Authentication Error Banner */}
              {authError && (
                <div className="login-banner error" role="alert" aria-live="assertive">
                  <AlertCircle size={18} className="banner-icon" />
                  <div className="banner-content">
                    {authError}
                  </div>
                </div>
              )}

              {/* General validation error summary if multiple fields fail */}
              {(errors.email && errors.password) && (
                <div className="login-banner error" role="alert">
                  <AlertCircle size={18} className="banner-icon" />
                  <div className="banner-content">
                    Please correct the errors below to continue.
                  </div>
                </div>
              )}

              {/* LOGIN FORM */}
              <form className="login-form" onSubmit={handleSignIn} noValidate>
                {/* Email Field */}
                <div className="form-group">
                  <label htmlFor="email-input" className="form-label">
                    Email address
                  </label>
                  <div className="input-container">
                    <input
                      id="email-input"
                      type="email"
                      className={`form-input ${errors.email ? 'is-invalid' : ''}`}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                        if (authError) setAuthError('');
                      }}
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                  </div>
                  {errors.email && (
                    <span id="email-error" className="form-error-msg" role="alert">
                      <AlertCircle size={13} />
                      {errors.email}
                    </span>
                  )}
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <label htmlFor="password-input" className="form-label">
                    Password
                  </label>
                  <div className="input-container">
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      className={`form-input has-toggle ${errors.password ? 'is-invalid' : ''}`}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                        if (authError) setAuthError('');
                      }}
                      autoComplete="current-password"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      className="input-icon-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span id="password-error" className="form-error-msg" role="alert">
                      <AlertCircle size={13} />
                      {errors.password}
                    </span>
                  )}
                </div>

                {/* Forgot Password Link */}
                <div className="form-options-row">
                  <button
                    type="button"
                    className="link-subtle"
                    onClick={() =>
                      openModal(
                        'Password Reset',
                        'Password reset functionality will be available in an upcoming release via email verification.',
                        'password'
                      )
                    }
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  className="btn-submit-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" aria-hidden="true"></span>
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              {/* Create Account Link */}
              <div className="card-footer-link">
                <span>New to Legal CaseBook?</span>
                <Link to="/register" className="btn-link-action">
                  Create an account
                </Link>
              </div>

              {/* Backend API Health Status Chip */}
              <div style={{ textAlign: 'center' }}>
                <div
                  className="backend-status-pill"
                  title="System Security Status"
                >
                  <span className={`status-dot ${backendHealth.status}`}></span>
                  <span>{backendHealth.message}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="login-footer" role="contentinfo">
        <div className="footer-inner">
          <span>&copy; 2026 Legal CaseBook</span>
          <span className="footer-divider" aria-hidden="true">&bull;</span>
          <button
            type="button"
            className="footer-link-btn"
            onClick={() =>
              openModal(
                'Privacy Policy',
                'Legal CaseBook prioritizes advocate-client privilege and confidentiality. Data isolation policies are active.',
                'security'
              )
            }
          >
            Privacy
          </button>
          <span className="footer-divider" aria-hidden="true">&bull;</span>
          <button
            type="button"
            className="footer-link-btn"
            onClick={() =>
              openModal(
                'Security Specifications',
                'Our architecture incorporates bank-grade TLS encryption in transit, cryptographic password protection, and strict role-based access control.',
                'security'
              )
            }
          >
            Security
          </button>
        </div>
      </footer>

      {/* Accessible Reusable Modal Dialog */}
      <InfoModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
}
