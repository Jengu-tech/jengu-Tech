import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Bienvenue sur Eguette");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero */}
      <div className="hidden lg:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-96 h-96 rounded-full bg-primary-glow/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl">Jengu-Tech</div>
            <div className="text-sm opacity-70">Resto Manager · Sénégal</div>
          </div>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Pilotez votre restaurant en temps réel.
          </h1>
          <p className="text-lg opacity-80">
            100+ commandes par jour, deux équipes, livreurs synchronisés. Tout depuis un seul tableau de bord.
          </p>
        </div>
        <div className="relative z-10 text-sm opacity-60">© Jengu-Teech 2026</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-card">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">Jengu-Tech</span>
          </div>

          <h2 className="font-display text-2xl font-bold mb-1">Accès Manager</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connexion réservée aux gestionnaires et admins. Les comptes sont créés
            uniquement par un administrateur Jengu-Tech.
          </p>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Pas encore de compte ? Contactez un administrateur pour obtenir un accès.
          </p>
        </Card>
      </div>
    </div>
  );
}
