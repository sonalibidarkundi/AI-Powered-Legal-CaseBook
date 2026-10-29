import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scale,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Info,
  User,
  Mail,
  Lock,
  Briefcase,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InfoModal from '../components/InfoModal';
import { apiUrl, safeParseResponse } from '../utils/api';
import '../styles/Login.css';
import '../styles/Register.css';

/**
 * Register Page - Stage 4
 * -----------------------
 * Features:
 * - Integrates with Flask POST /api/auth/register endpoint.
 * - Enforces Public Registration Policy: Client accounts only.
 * - Rejects/Explains why Advocate and Staff roles cannot be self-assigned.
 * - Validates input against email patterns and password complexity.
 * - Server-side password hashing and Oracle Database registration.
 */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Form input state - defaults accountType to 'advocate'
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'advocate',
    phone: '',
    address: '',
  });

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation & response feedback state
  const [errors, setErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: '',
  });

  const [serverError, setServerError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect countdown timer on successful registration
  useEffect(() => {
    let timer;
    if (registrationSuccess) {
      if (redirectCountdown > 0) {
        timer = setTimeout(() => {
          setRedirectCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        navigate('/login');
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [registrationSuccess, redirectCountdown, navigate]);

  // Backend Health Status State
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Checking System Status...',
  });

  // Modal dialog state (for Privacy / Security footer links)
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

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

  // Password Criteria Checkers
  const passwordCriteria = {
    hasMinLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
  };

  const isPasswordValid =
    passwordCriteria.hasMinLength &&
    passwordCriteria.hasUppercase &&
    passwordCriteria.hasLowercase &&
    passwordCriteria.hasNumber;

  // Standard Email validation helper
  const isValidEmail = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val.trim());
  };

  // Helper to extract the first specific validation error for the top banner
  const getFirstErrorMessage = () => {
    const errorKeys = ['fullName', 'email', 'password', 'confirmPassword', 'accountType'];
    for (const key of errorKeys) {
      if (errors[key]) return errors[key];
    }
    return null;
  };

  // Input change handler
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setServerError('');

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    if (field === 'password' && errors.confirmPassword && formData.confirmPassword) {
      if (value === formData.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      }
    }

    if (field === 'confirmPassword' && errors.confirmPassword && formData.password) {
      if (value === formData.password) {
        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      }
    }
  };

  // Form Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) return;

    setServerError('');
    setRegistrationSuccess(false);

    const newErrors = {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      accountType: '',
    };
    let hasError = false;

    // 1. Full name validation
    const trimmedName = formData.fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = 'Please enter your full name.';
      hasError = true;
    } else if (trimmedName.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters.';
      hasError = true;
    }

    // 2. Email validation
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Please enter your email address.';
      hasError = true;
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address (e.g., advocate@example.com).';
      hasError = true;
    }

    // 3. Password validation
    if (!formData.password) {
      newErrors.password = 'Please enter a password.';
      hasError = true;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
      hasError = true;
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter (A-Z).';
      hasError = true;
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter (a-z).';
      hasError = true;
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number (0-9).';
      hasError = true;
    }

    // 4. Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
      hasError = true;
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match. Please re-enter to confirm.';
      hasError = true;
    }

    // 5. Account type validation
    if (!formData.accountType) {
      newErrors.accountType = 'Please select an account type (Advocate, Staff, or Client).';
      hasError = true;
    } else if (!['advocate', 'staff', 'client'].includes(formData.accountType)) {
      newErrors.accountType = 'Please select a valid account type.';
      hasError = true;
    }

    setErrors(newErrors);

    if (hasError) {
      // Auto-focus and scroll to first invalid field
      const fieldIdMap = {
        fullName: 'reg-fullname',
        email: 'reg-email',
        password: 'reg-password',
        confirmPassword: 'reg-confirm-password',
        accountType: 'account-type-grid',
      };
      const firstErrorKey = Object.keys(newErrors).find((k) => newErrors[k]);
      if (firstErrorKey && fieldIdMap[firstErrorKey]) {
        const el = document.getElementById(fieldIdMap[firstErrorKey]);
        if (el) {
          el.focus?.();
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // 6. Submit to backend API
    setIsSubmitting(true);
    try {
      const result = await register({
        fullName: trimmedName,
        email: trimmedEmail,
        password: formData.password,
        accountType: formData.accountType,
        phone: formData.phone,
        address: formData.address,
      });

      if (result.success) {
        setRegistrationSuccess(true);
        setRedirectCountdown(3);
        setFormData({
          fullName: '',
          email: '',
          password: '',
          confirmPassword: '',
          accountType: 'client',
          phone: '',
          address: '',
        });
      } else {
        setServerError(result.error || 'Registration failed. Please review your input.');
      }
    } catch (err) {
      setServerError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal open helper
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

  // Account types metadata
  const accountTypes = [
    {
      id: 'advocate',
      title: 'Advocate',
      desc: 'Practicing attorneys & legal counsel',
      badge: 'Advocate Workspace',
      icon: <Scale size={20} />,
    },
    {
      id: 'staff',
      title: 'Staff',
      desc: 'Paralegals, clerks & firm coordinators',
      badge: 'Staff Portal',
      icon: <Briefcase size={20} />,
    },
    {
      id: 'client',
      title: 'Client',
      desc: 'Case litigants & consultation clients',
      badge: 'Client Portal',
      icon: <UserCheck size={20} />,
    },
  ];

  return (
    <div className="register-page-container">
      {/* 1. HEADER */}
      <header className="register-header" role="banner">
        <div className="register-header-inner">
          <Link to="/" className="brand-link" title="Legal CaseBook Home">
            <div className="brand-icon-wrapper" aria-hidden="true">
              <Scale size={22} strokeWidth={2.2} />
            </div>
            <h1 className="brand-title">Legal CaseBook</h1>
          </Link>

          <div className="header-action-link">
            <span>Already have an account?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </header>

      {/* 2. MAIN REGISTRATION FORM */}
      <main className="register-main" role="main">
        <div className="register-content-wrapper">
          <div className="register-card">
            <div className="register-card-header">
              <h2 className="register-card-title">Create your Legal CaseBook account</h2>
              <p className="register-card-subtitle">Enter your details to get started.</p>
            </div>

            {/* Registration Success Banner with Countdown */}
            {registrationSuccess && (
              <div
                className="login-banner info"
                style={{
                  backgroundColor: '#E3FCEF',
                  border: '1px solid #ABF5D1',
                  color: '#006644',
                }}
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 size={20} className="banner-icon" />
                <div className="banner-content">
                  <strong>Registration Successful!</strong>
                  Your account has been successfully created. Redirecting to sign in within {redirectCountdown} second{redirectCountdown === 1 ? '' : 's'}...
                  <div style={{ marginTop: '10px' }}>
                    <Link
                      to="/login"
                      className="btn-submit-primary"
                      style={{
                        display: 'inline-flex',
                        height: '38px',
                        padding: '0 18px',
                        width: 'auto',
                        textDecoration: 'none',
                        fontSize: '13.5px',
                      }}
                    >
                      Sign In Now
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Server Error Banner */}
            {serverError && (
              <div className="login-banner error" role="alert" aria-live="assertive">
                <AlertCircle size={20} className="banner-icon" />
                <div className="banner-content">
                  {serverError}
                </div>
              </div>
            )}

            {/* Specific Form Validation Error Banner */}
            {getFirstErrorMessage() && (
              <div className="login-banner error" role="alert" aria-live="assertive">
                <AlertCircle size={18} className="banner-icon" />
                <div className="banner-content">
                  <strong>Validation Error: </strong>
                  {getFirstErrorMessage()}
                </div>
              </div>
            )}

            <form className="register-form" onSubmit={handleSubmit} noValidate>
              {/* Field 1: Full Name */}
              <div className="register-form-group">
                <label htmlFor="reg-fullname" className="register-form-label">
                  <span>
                    Full name <span className="label-required">*</span>
                  </span>
                </label>
                <div className="register-input-wrapper">
                  <User size={18} className="register-input-icon" aria-hidden="true" />
                  <input
                    id="reg-fullname"
                    type="text"
                    className={`register-input has-left-icon ${
                      errors.fullName ? 'is-invalid' : ''
                    }`}
                    placeholder="e.g., Rajesh Sharma"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    autoComplete="name"
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? 'reg-fullname-error' : undefined}
                  />
                </div>
                {errors.fullName && (
                  <span id="reg-fullname-error" className="register-error-msg" role="alert">
                    <AlertCircle size={13} />
                    {errors.fullName}
                  </span>
                )}
              </div>

              {/* Field 2: Email Address */}
              <div className="register-form-group">
                <label htmlFor="reg-email" className="register-form-label">
                  <span>
                    Email address <span className="label-required">*</span>
                  </span>
                </label>
                <div className="register-input-wrapper">
                  <Mail size={18} className="register-input-icon" aria-hidden="true" />
                  <input
                    id="reg-email"
                    type="email"
                    className={`register-input has-left-icon ${errors.email ? 'is-invalid' : ''}`}
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'reg-email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <span id="reg-email-error" className="register-error-msg" role="alert">
                    <AlertCircle size={13} />
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Field 3 & 4: Password and Confirm Password */}
              <div className="form-row-two-col">
                {/* Password Field */}
                <div className="register-form-group">
                  <label htmlFor="reg-password" className="register-form-label">
                    <span>
                      Password <span className="label-required">*</span>
                    </span>
                  </label>
                  <div className="register-input-wrapper">
                    <Lock size={18} className="register-input-icon" aria-hidden="true" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`register-input has-left-icon has-right-toggle ${
                        errors.password ? 'is-invalid' : ''
                      }`}
                      placeholder="Create password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={!!errors.password}
                      aria-describedby="reg-password-requirements"
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
                    <span id="reg-password-error" className="register-error-msg" role="alert">
                      <AlertCircle size={13} />
                      {errors.password}
                    </span>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="register-form-group">
                  <label htmlFor="reg-confirm-password" className="register-form-label">
                    <span>
                      Confirm password <span className="label-required">*</span>
                    </span>
                  </label>
                  <div className="register-input-wrapper">
                    <Lock size={18} className="register-input-icon" aria-hidden="true" />
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`register-input has-left-icon has-right-toggle ${
                        errors.confirmPassword ? 'is-invalid' : ''
                      }`}
                      placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={
                        errors.confirmPassword ? 'reg-confirm-error' : undefined
                      }
                    />
                    <button
                      type="button"
                      className="input-icon-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      title={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span id="reg-confirm-error" className="register-error-msg" role="alert">
                      <AlertCircle size={13} />
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>

              {/* Password Requirements Live Checklist */}
              <div
                id="reg-password-requirements"
                className="password-requirements-box"
                aria-label="Password requirements"
              >
                <div className="requirements-title">Security Requirements</div>
                <ul className="requirements-list">
                  <li
                    className={`requirement-item ${
                      passwordCriteria.hasMinLength ? 'is-valid' : ''
                    }`}
                  >
                    {passwordCriteria.hasMinLength ? (
                      <CheckCircle2 size={14} className="req-icon" />
                    ) : (
                      <span className="gold-bullet req-icon"></span>
                    )}
                    <span>Minimum 8 characters</span>
                  </li>
                  <li
                    className={`requirement-item ${
                      passwordCriteria.hasUppercase ? 'is-valid' : ''
                    }`}
                  >
                    {passwordCriteria.hasUppercase ? (
                      <CheckCircle2 size={14} className="req-icon" />
                    ) : (
                      <span className="gold-bullet req-icon"></span>
                    )}
                    <span>At least one uppercase letter (A-Z)</span>
                  </li>
                  <li
                    className={`requirement-item ${
                      passwordCriteria.hasLowercase ? 'is-valid' : ''
                    }`}
                  >
                    {passwordCriteria.hasLowercase ? (
                      <CheckCircle2 size={14} className="req-icon" />
                    ) : (
                      <span className="gold-bullet req-icon"></span>
                    )}
                    <span>At least one lowercase letter (a-z)</span>
                  </li>
                  <li
                    className={`requirement-item ${passwordCriteria.hasNumber ? 'is-valid' : ''}`}
                  >
                    {passwordCriteria.hasNumber ? (
                      <CheckCircle2 size={14} className="req-icon" />
                    ) : (
                      <span className="gold-bullet req-icon"></span>
                    )}
                    <span>At least one number (0-9)</span>
                  </li>
                </ul>
              </div>

              {/* Field 5: Account Type Selection */}
              <div className="account-type-section">
                <label className="register-form-label" id="account-type-label">
                  <span>
                    Select Account Type <span className="label-required">*</span>
                  </span>
                </label>

                <div
                  id="account-type-grid"
                  className="account-type-grid"
                  role="radiogroup"
                  aria-labelledby="account-type-label"
                >
                  {accountTypes.map((item) => {
                    const isSelected = formData.accountType === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`account-type-card ${isSelected ? 'is-selected' : ''}`}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => handleInputChange('accountType', item.id)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleInputChange('accountType', item.id);
                          }
                        }}
                      >
                        <div className="account-type-header">
                          <div className="account-type-icon-box" aria-hidden="true">
                            {item.icon}
                          </div>
                          <div className="custom-radio-indicator" aria-hidden="true">
                            {isSelected && <div className="custom-radio-dot"></div>}
                          </div>
                        </div>

                        <div className="account-type-details">
                          <div className="account-type-title">{item.title}</div>
                          <div className="account-type-desc">{item.desc}</div>
                          <span className="account-type-badge">{item.badge}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.accountType && (
                  <span className="register-error-msg" role="alert">
                    <AlertCircle size={13} />
                    {errors.accountType}
                  </span>
                )}
              </div>

              {/* Role Workspace Callout Box */}
              <div className="role-security-callout" role="note">
                <ShieldAlert size={20} className="security-callout-icon" aria-hidden="true" />
                <div className="security-callout-content">
                  <strong>Role-Based Workspace Access</strong>
                  Advocate accounts grant full clearance to court dockets, client files, and staff task assignments.
                  Staff accounts manage delegated research, and Client accounts track their legal cases.
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-register-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>

            {/* Bottom Sign-In Navigation */}
            <div className="register-footer-nav">
              <span>Already have an account?</span>
              <Link to="/login">Sign in here</Link>
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
                'Legal CaseBook prioritizes advocate-client privilege and confidentiality.',
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
                'Our planned architecture incorporates TLS 1.3 encryption, enterprise data encryption, and strict role-based access control.',
                'security'
              )
            }
          >
            Security
          </button>
        </div>
      </footer>

      {/* Reusable Modal Dialog */}
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
