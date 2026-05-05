import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { RoleUtilisateur } from "@/lib/types";

interface Props {
  children: React.ReactNode;
  /** Rôles autorisés. Par défaut admin + gestionnaire. */
  allowedRoles?: RoleUtilisateur[];
}

export default function ProtectedRoute({
  children,
  allowedRoles = ["admin", "gestionnaire"],
}: Props) {
  const { user, role, loading, roleLoading, signOut } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // SÉCURITÉ : un utilisateur sans rôle (null) n'a JAMAIS accès. Cela évite
  // qu'un compte fraîchement créé sans entrée dans user_roles soit traité
  // comme admin par défaut.
  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
          <p className="text-muted-foreground text-sm">
            Votre compte n'a pas encore les autorisations nécessaires pour accéder
            à cette plateforme. Contactez un administrateur Eguette pour obtenir
            l'accès.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
            }}
          >
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
