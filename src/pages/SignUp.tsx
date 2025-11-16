// src/pages/SignUp.tsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Form, Button, Card, Alert } from "react-bootstrap";

export const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const { error } = await signUp(email, password);
    if (error) setError(error.message);
    else setSuccess("Account created! Check your email to confirm.");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#121212", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Card style={{ width: "400px", backgroundColor: "#1E1E1E", color: "#fff" }} className="p-4 shadow">
        <h3 className="mb-3 text-center">Sign Up</h3>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        <Form onSubmit={handleSignUp}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ backgroundColor: "#2C2C2C", color: "#fff", border: "none" }}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ backgroundColor: "#2C2C2C", color: "#fff", border: "none" }}
            />
          </Form.Group>
          <Button
            type="submit"
            className="w-100 mt-3"
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              fontWeight: "bold",
              border: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FFC107")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFD700")}
          >
            Sign Up
          </Button>
        </Form>
      </Card>
    </div>
  );
};
