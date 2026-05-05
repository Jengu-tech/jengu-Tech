import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { livreursService } from "@/services/livreursService";
import { commandesService } from "@/services/commandesService";
import type { Equipe, Livreur } from "@/lib/types";

interface AssignerLivreurProps {
  commandeId: string;
  /** Si fourni, ne montre que les livreurs de cette équipe */
  equipe?: Equipe;
  /** Nom du livreur déjà assigné (rend le composant en lecture seule) */
  livreurAssigneNom?: string | null;
  /** Callback après assignation réussie (livreurId + nom pour MAJ optimiste) */
  onAssigned?: (livreurId: string, nom: string) => void;
  className?: string;
}

/**
 * Bouton "Assigner un livreur" :
 *   - Si une commande a déjà un livreur, affiche son nom (lecture seule).
 *   - Sinon, affiche un VRAI bouton qui ouvre un menu déroulant listant
 *     les livreurs en service (en_service = true), chargés en temps réel
 *     depuis Supabase. Sélectionner un livreur déclenche immédiatement
 *     l'UPDATE de la commande (livreur_id + statut = "acceptee").
 */
export function AssignerLivreur({
  commandeId,
  equipe,
  livreurAssigneNom,
  onAssigned,
  className,
}: AssignerLivreurProps) {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const charger = async () => {
    try {
      const list = await livreursService.listerEnService(equipe);
      setLivreurs(list);
    } catch {
      // Silencieux — éviter de logger toute donnée sensible (livreurs/clients)
    }
  };

  useEffect(() => {
    if (livreurAssigneNom) return; // pas besoin de charger si déjà assigné
    let active = true;
    const safeCharger = async () => {
      if (!active) return;
      await charger();
    };
    safeCharger();
    const off = livreursService.ecouterChangements(safeCharger);
    return () => {
      active = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipe, livreurAssigneNom]);

  // ── État "déjà assigné" : on affiche juste le nom, non modifiable ───────
  if (livreurAssigneNom) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success border border-success/30 ${className ?? ""}`}
      >
        <span className="h-2 w-2 rounded-full bg-success" />
        Livreur : <span className="font-semibold">{livreurAssigneNom}</span>
      </span>
    );
  }

  const choisir = async (livreurId: string, nom: string) => {
    setLoading(true);
    try {
      await commandesService.assignerLivreur(commandeId, livreurId);
      toast.success(`Livreur assigné : ${nom}`);
      setOpen(false);
      onAssigned?.(livreurId, nom);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(`Échec de l'assignation : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={loading}
          className={`shadow-elegant bg-primary text-primary-foreground hover:bg-primary/90 ${className ?? ""}`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-1.5" />
          )}
          {loading ? "Assignation…" : "Assigner un livreur"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-popover">
        <DropdownMenuLabel>Livreurs en service</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {livreurs.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            Aucun livreur en service
          </div>
        ) : (
          livreurs.map((l) => (
            <DropdownMenuItem
              key={l.id}
              onSelect={(e) => {
                e.preventDefault();
                choisir(l.id, l.nom);
              }}
              className="cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 w-full">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="font-medium">{l.nom}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {l.equipe}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
