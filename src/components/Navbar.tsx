// src/components/Navbar.tsx
import React from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Navbar.css";

export const DashboardNavbar: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="custom-navbar">
      <Container>
        <Navbar.Brand as={Link} to="/" className="brand-logo">LED TimeTracker</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/time-tracker" className="nav-link-custom">Time Tracker</Nav.Link>
            <Nav.Link as={Link} to="/file-bank" className="nav-link-custom">File Bank</Nav.Link>
          </Nav>
          <Button className="logout-btn-nav" onClick={signOut}>
            <span className="btn-icon-nav">→</span>
            <span>Logout</span>
          </Button>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};