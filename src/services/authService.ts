import { supabase } from "@/lib/supabase";
import type { RoleUtilisateur } from "@/lib/types";

const isDev = import.meta.env.DEV;

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  /**
   * Lit le rôle depuis user_roles. Retourne null si l'utilisateur n'a aucun rôle
   * ou en cas d'erreur — le code consommateur DOIT traiter `null` comme
   * "non autorisé" et JAMAIS comme un fallback admin.
   */
  async getRole(userId: string): Promise<RoleUtilisateur | null> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (isDev) console.warn("[authService] user_roles indisponible");
      return null;
    }
    return (data?.role as RoleUtilisateur | undefined) ?? null;
  },
};
