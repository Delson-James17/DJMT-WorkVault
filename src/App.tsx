// src/App.tsx
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DashboardNavbar } from "./components/Navbar";
import 'bootstrap/dist/css/bootstrap.min.css';

// Import Login and SignUp normally (they're small)
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";

// Only lazy load heavy components
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const TimeTrackerEditor = lazy(() => import("./components/Editor/TimeTrackerEditor").then(m => ({ default: m.TimeTrackerEditor })));
const FileBank = lazy(() => import("./components/FileBank/FileBank").then(m => ({ default: m.FileBank })));

const LoadingFallback = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const hideNavbar = ['/login', '/signup'].includes(location.pathname);

  return (
    <>
      {!hideNavbar && <DashboardNavbar />}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/time-tracker" element={
            <ProtectedRoute>
              <TimeTrackerEditor />
            </ProtectedRoute>
          } />
          <Route path="/file-bank" element={
            <ProtectedRoute>
              <FileBank />
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};