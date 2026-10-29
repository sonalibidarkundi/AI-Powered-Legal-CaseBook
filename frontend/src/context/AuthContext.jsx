import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiUrl, safeParseResponse } from '../utils/api';

/**
 * AuthContext
 * -----------
 * Manages user authentication state, session restoration,
 * login, registration, and logout across the React application.
 *
 * Security:
 * - Credentials (session cookies) are handled natively by the browser (HttpOnly).
 * - Sensitive passwords and session IDs are NEVER stored in localStorage.
 * - CSRF tokens are stored in memory and attached to state-changing requests.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState('');

  // Fetch CSRF token and restore session on application load
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        // 1. Fetch initial anti-CSRF token
        const csrfRes = await fetch(apiUrl('/api/auth/csrf'), { credentials: 'include' });
        if (csrfRes.ok) {
          const csrfData = await safeParseResponse(csrfRes);
          if (isMounted && csrfData.csrf_token) {
            setCsrfToken(csrfData.csrf_token);
          }
        }

        // 2. Check if a valid session cookie exists
        const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
        if (meRes.ok) {
          const meData = await safeParseResponse(meRes);
          if (isMounted && meData.authenticated && meData.user) {
            setUser(meData.user);
            if (meData.csrf_token) {
              setCsrfToken(meData.csrf_token);
            }
          }
        } else {
          if (isMounted) setUser(null);
        }
      } catch (err) {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = async (email, password) => {
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await safeParseResponse(response);

      if (response.ok && data.user) {
        setUser(data.user);
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }
        return { success: true, user: data.user };
      } else {
        return {
          success: false,
          error: data.error || 'Authentication failed. Please check your credentials.',
          code: data.code,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Unable to connect to the authentication server (${err.message || 'connection failed'}). Please check that Flask is running.`,
      };
    }
  };

  // Register handler
  const register = async (formData) => {
    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await safeParseResponse(response);

      if (response.ok && !data.code?.startsWith('ROUTING_MISMATCH') && !data.code?.startsWith('SERVER_ERROR')) {
        return { success: true, message: data.message, user: data.user };
      } else {
        return {
          success: false,
          error: data.error || 'Registration failed. Please review your input.',
          code: data.code,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Network error connecting to registration service (${err.message || 'connection failed'}). Please check connection and try again.`,
      };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });
    } catch (err) {
      // Clean up local state regardless of network response
    } finally {
      setUser(null);
    }
  };

  // Role elevation / workspace clearance switcher
  const elevateRole = async (targetRole = 'ADVOCATE') => {
    try {
      const response = await fetch(apiUrl('/api/auth/elevate-role'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await safeParseResponse(response);
      if (response.ok && data.user) {
        setUser(data.user);
        return { success: true, user: data.user, message: data.message };
      } else {
        return { success: false, error: data.error || 'Failed to update clearance.' };
      }
    } catch (err) {
      return { success: false, error: 'Network error updating security clearance.' };
    }
  };

  const value = {
    user,
    loading,
    csrfToken,
    login,
    register,
    logout,
    elevateRole,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
