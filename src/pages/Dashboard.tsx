// src/pages/Dashboard.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Container, Row, Col } from "react-bootstrap";
import { DailyMotivation } from "../components/DailyMotivation";
import { DailyTrivia } from "../components/DailyTrivia";
import "./Dashboard.css";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-wrapper">
      <div className="animated-bg"></div>
      <Container className="dashboard-container">
        <div className="header-section">
          <div className="welcome-content">
            <div className="welcome-badge">DASHBOARD</div>
            <h1 className="welcome-title">
              Welcome back,
              <span className="user-name">{user?.email?.split('@')[0]}</span>
            </h1>
            <p className="welcome-subtitle">Ready to conquer today?</p>
          </div>
        </div>

        <Row className="content-grid">
          <Col md={6} className="mb-4">
            <div className="card-wrapper card-left">
              <DailyTrivia />
            </div>
          </Col>
          <Col md={6} className="mb-4">
            <div className="card-wrapper card-right">
              <DailyMotivation />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};