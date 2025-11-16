// src/App.tsx
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DashboardNavbar } from "./components/Navbar";
import 'bootstrap/dist/css/bootstrap.min.css';

// Lazy load pages and components
const Login = lazy(() => import("./pages/Login").then(module => ({ default: module.Login })));
const SignUp = lazy(() => import("./pages/SignUp").then(module => ({ default: module.SignUp })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })));
const TimeTrackerEditor = lazy(() => import("./components/Editor/TimeTrackerEditor").then(module => ({ default: module.TimeTrackerEditor })));
const FileBank = lazy(() => import("./components/FileBank/FileBank").then(module => ({ default: module.FileBank })));

// Loading component
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

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <DashboardNavbar />
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
      </Router>
    </AuthProvider>
  );
};