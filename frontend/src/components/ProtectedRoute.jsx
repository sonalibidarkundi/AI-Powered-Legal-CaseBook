import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale } from 'lucide-react';

/**
 * ProtectedRoute Component
 * ------------------------
 * Enforces authentication and role-based access for frontend routes.
 *
 * Rules:
 * 1. While loading session state: renders a minimal legal-tech spinner.
 * 2. If unauthenticated: redirects to /login preserving intended location.
 * 3. If authenticated but role not in allowedRoles: redirects to /forbidden.
 * 4. If authorized: renders protected child page.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        color: '#172B4D',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #172B4D 0%, #101F38 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#B99A5B',
          boxShadow: '0 4px 12px rgba(23, 43, 77, 0.15)'
        }}>
          <Scale size={26} strokeWidth={2.2} />
        </div>
        <div className="spinner" style={{
          width: '24px',
          height: '24px',
          border: '3px solid rgba(23, 43, 77, 0.15)',
          borderTopColor: '#172B4D'
        }}></div>
        <span style={{ fontSize: '14px', color: '#5E6C84', fontWeight: 500 }}>
          Verifying security clearance...
        </span>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role restriction check - automatically redirect to user's authorized workspace
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const authorizedPath = `/${(user.role || 'client').toLowerCase()}/dashboard`;
    return <Navigate to={authorizedPath} replace />;
  }

  return children;
}
