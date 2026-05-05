import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { RoleUtilisateur } from "@/lib/types";
import { authService } from "@/services/authService";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: RoleUtilisateur | null;
  /** True tant qu'on n'a pas tenté de charger le rôle (évite les flashs admin). */
  roleLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<RoleUtilisateur | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener AVANT getSession (recommandé)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setRoleLoading(true);
        // Defer Supabase call pour éviter deadlock
        setTimeout(() => {
          authService
            .getRole(sess.user.id)
            .then(setRole)
            .catch(() => setRole(null))
            .finally(() => setRoleLoading(false));
        }, 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        authService
          .getRole(s.user.id)
          .then(setRole)
          .catch(() => setRole(null))
          .finally(() => setRoleLoading(false));
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    role,
    roleLoading,
    loading,
    signIn: async (e, p) => { await authService.signIn(e, p); },
    signOut: async () => { await authService.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
