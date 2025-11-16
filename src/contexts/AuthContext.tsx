import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import type { AuthError, Session, User as SupabaseUser } from "@supabase/supabase-js";

type User = { id: string; email?: string | null } | null;

interface AuthContextValue {
  user: User;

  signUp: (
    email: string,
    password: string
  ) => Promise<{
    data: { user: SupabaseUser | null; session: Session | null };
    error: AuthError | null;
  }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    data: { user: SupabaseUser | null; session: Session | null };
    error: AuthError | null;
  }>;

  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    supabase.auth.getSession().then((result) => {
      const u = result.data.session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = (email: string, password: string) =>
    supabase.auth.signUp({ email, password });

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

/* eslint-disable react-refresh/only-export-components */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};
