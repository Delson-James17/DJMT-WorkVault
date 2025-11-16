// src/pages/Dashboard.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Container, Row, Col, Button } from "react-bootstrap";
import { DailyMotivation } from "../components/DailyMotivation";
import {DailyTrivia} from "../components/DailyTrivia";
export const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <Container className="mt-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4>Welcome, {user?.email}</h4>
        </Col>
        <Col className="text-end">
          <Button variant="danger" onClick={signOut}>Logout</Button>
        </Col>
      </Row>

      <Row>
         <Col md={6} className="mb-3">
             <DailyTrivia />
        </Col>
        <Col md={6} className="mb-3">
          <DailyMotivation />
        </Col>
      </Row>
    </Container>
  );
};
