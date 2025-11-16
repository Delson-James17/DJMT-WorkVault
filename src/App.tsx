// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { Dashboard } from "./pages/Dashboard";
import { TimeTrackerEditor } from "./components/Editor/TimeTrackerEditor";
import { FileBank } from "./components/FileBank/FileBank";
import { DashboardNavbar } from "./components/Navbar";
import 'bootstrap/dist/css/bootstrap.min.css';

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
      </Router>
    </AuthProvider>
  );
};
