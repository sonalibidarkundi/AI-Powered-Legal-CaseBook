import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import AdvocateDashboard from './pages/AdvocateDashboard';
import StaffDashboard from './pages/StaffDashboard';
import ClientDashboard from './pages/ClientDashboard';

/**
 * App Root Component - Stage 4
 * ----------------------------
 * Configures application-wide AuthProvider and role-protected routing.
 *
 * Route Map:
 * - Public:
 *   - /login       -> Login Page
 *   - /register    -> Registration Page
 * - Protected Workspaces (RBAC):
 *   - /advocate/dashboard -> Restricted to ADVOCATE
 *   - /staff/dashboard    -> Restricted to STAFF and ADVOCATE
 *   - /client/dashboard   -> Restricted to CLIENT and ADVOCATE
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forbidden" element={<Navigate to="/login" replace />} />

          {/* Role-Protected Workspaces */}
          <Route
            path="/advocate/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADVOCATE']}>
                <AdvocateDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute allowedRoles={['STAFF']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/client/dashboard"
            element={
              <ProtectedRoute allowedRoles={['CLIENT']}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
