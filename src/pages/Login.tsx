// src/pages/Login.tsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {Card, Form, Button } from "react-bootstrap";

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) alert(error.message);
      else navigate("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#121212", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: "100%", maxWidth: 400, backgroundColor: "#1e1e1e", padding: "2rem", borderRadius: 12 }}>
        <Card.Body>
          <Card.Title className="text-center text-white mb-4">Login</Card.Title>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formEmail">
              <Form.Label className="text-white">Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formPassword">
              <Form.Label className="text-white">Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button type="submit" style={{ backgroundColor: "#FFC107", border: "none", width: "100%" }} disabled={loading}>
              {loading ? "Signing in…" : "Login"}
            </Button>
          </Form>

          <div className="text-center mt-3">
            <span className="text-white">Don't have an account? </span>
            <Link to="/signup" style={{ color: "#FFC107", textDecoration: "none" }}>Sign Up</Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};
