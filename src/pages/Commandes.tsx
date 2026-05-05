import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Clock, RefreshCw, FileDown } from "lucide-react";
import { useHorlogeEquipe } from "@/hooks/useHorlogeEquipe";
import { commandesService } from "@/services/commandesService";
import { livreursService } from "@/services/livreursService";
import { AssignerLivreur } from "@/components/AssignerLivreur";
import type { Commande, Livreur, StatutCommande } from "@/lib/types";
import { toast } from "sonner";
import { formatFCFA, maskTelephone } from "@/lib/format";
import { exporterCommandesPDF } from "@/lib/pdfExport";

const STATUT_LABEL: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  livree: "Livrée",
  annulee: "Annulée",
};

const STATUT_COLOR: Record<StatutCommande, string> = {
  en_attente: "bg-warning/15 text-warning-foreground border-warning/40",
  acceptee: "bg-blue-500/15 text-blue-700 border-blue-500/40",
  livree: "bg-success/15 text-success border-success/40",
  annulee: "bg-destructive/15 text-destructive border-destructive/40",
};

export default function Commandes() {
  const { now, equipe } = useHorlogeEquipe();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<string>("all");
  const [filtreEquipe, setFiltreEquipe] = useState<string>("all");
  const [dernierRefresh, setDernierRefresh] = useState(new Date());
  const [open, setOpen] = useState(false);

  const charger = async () => {
    try {
      const [cs, ls] = await Promise.all([commandesService.lister(), livreursService.lister()]);
      setCommandes(cs);
      setLivreurs(ls);
      setDernierRefresh(new Date());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    charger();
    const off = commandesService.ecouterChangements(charger);
    const id = setInterval(charger, 15000);
    return () => { off(); clearInterval(id); };
  }, []);

  const filtres = useMemo(() => {
    return commandes.filter((c) => {
      if (filtreStatut !== "all" && c.statut !== filtreStatut) return false;
      if (filtreEquipe !== "all" && c.equipe !== filtreEquipe) return false;
      return true;
    });
  }, [commandes, filtreStatut, filtreEquipe]);

  

  return (
    <div className="p-8 space-y-6">
      {/* Header avec horloge */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Commandes</h1>
          <p className="text-muted-foreground mt-1">Saisie et suivi en temps réel</p>
        </div>

        <Card className="px-5 py-3 bg-gradient-hero text-primary-foreground border-0 shadow-elegant flex items-center gap-4">
          <Clock className="h-5 w-5" />
          <div>
            <div className="font-mono text-2xl font-bold leading-none">{now.toLocaleTimeString("fr-FR")}</div>
            <div className="text-xs opacity-80 mt-1">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
          <div className="h-10 w-px bg-primary-foreground/20" />
          <div>
            <div className="text-xs opacity-80">Équipe active</div>
            <div className="font-display text-xl font-bold">{equipe}</div>
          </div>
        </Card>
      </div>

      {/* Actions / filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-elegant"><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
            <FormulaireCommande
              equipe={equipe}
              onSuccess={() => { setOpen(false); charger(); toast.success("Commande créée"); }}
            />
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          onClick={() => {
            try {
              if (filtres.length === 0) {
                toast.error("Aucune commande à exporter");
                return;
              }
              const sousTitre =
                filtreStatut === "all" && filtreEquipe === "all"
                  ? "Toutes les commandes"
                  : `Filtre : ${filtreStatut !== "all" ? STATUT_LABEL[filtreStatut as StatutCommande] : "tous statuts"} · ${filtreEquipe !== "all" ? filtreEquipe : "toutes équipes"}`;
              exporterCommandesPDF(filtres, { sousTitre });
              toast.success("Export PDF généré");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur d'export");
            }
          }}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Exporter en PDF
        </Button>

        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {(Object.keys(STATUT_LABEL) as StatutCommande[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUT_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtreEquipe} onValueChange={setFiltreEquipe}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Équipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes équipes</SelectItem>
            <SelectItem value="Matin">Matin</SelectItem>
            <SelectItem value="Soir">Soir</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="pulse-dot" />
          Mis à jour à {dernierRefresh.toLocaleTimeString("fr-FR")}
          <Button variant="ghost" size="icon" onClick={charger} className="h-7 w-7"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtres.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">Aucune commande</Card>
        ) : (
          filtres.map((c) => (
            <CarteCommande
              key={c.id}
              commande={c}
              livreurNom={livreurs.find((l) => l.id === c.livreur_id)?.nom}
              livreurs={livreurs}
              onChange={charger}
              onPatch={(patch) =>
                setCommandes((prev) =>
                  prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x))
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function CarteCommande({ commande, livreurNom, livreurs, onChange, onPatch }: {
  commande: Commande;
  livreurNom?: string;
  livreurs: Livreur[];
  onChange: () => void;
  onPatch: (patch: Partial<Commande>) => void;
}) {
  const changer = async (s: StatutCommande) => {
    try {
      await commandesService.changerStatut(commande.id, s);
      onPatch({ statut: s, ...(s === "livree" ? { livree_at: new Date().toISOString() } : {}) });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  // Nom du livreur calculé depuis la liste pour réagir immédiatement aux MAJ
  const nomAffiche = commande.livreur_id
    ? (livreurs.find((l) => l.id === commande.livreur_id)?.nom ?? livreurNom ?? "Livreur inconnu")
    : null;

  return (
    <Card className="p-5 shadow-card hover:shadow-elegant transition-smooth">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{commande.client_nom}</h3>
            <Badge variant="outline" className={STATUT_COLOR[commande.statut]}>{STATUT_LABEL[commande.statut]}</Badge>
            <Badge variant="secondary">{commande.equipe}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {maskTelephone(commande.client_telephone)} · {commande.client_adresse}
            {commande.zone && <> · <span className="text-foreground">Zone : {commande.zone}</span></>}
          </div>
          <div className="text-sm mt-2 whitespace-pre-line">{commande.plats}</div>
        </div>

        <div className="text-right">
          <div className="font-display text-xl font-bold">{formatFCFA(Number(commande.montant_repas))}</div>
          <div className="text-xs text-muted-foreground">
            Créée à : {new Date(commande.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {commande.statut === "livree" && commande.livree_at && (
            <div className="text-xs text-success font-medium">
              Livrée à : {new Date(commande.livree_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          {commande.statut === "annulee" && commande.annulee_at && (
            <div className="text-xs text-destructive font-medium">
              Annulée à : {new Date(commande.annulee_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
        <AssignerLivreur
          commandeId={commande.id}
          equipe={commande.equipe}
          livreurAssigneNom={nomAffiche}
          onAssigned={(livreurId, nom) => {
            onPatch({ livreur_id: livreurId, statut: "acceptee" });
            onChange();
          }}
        />

        <div className="ml-auto flex gap-2">
          {commande.statut !== "livree" && commande.statut !== "annulee" && (
            <>
              <Button size="sm" onClick={() => changer("livree")}>Marquer livrée</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => changer("annulee")}>Annuler</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function FormulaireCommande({ equipe, onSuccess }: { equipe: "Matin" | "Soir"; onSuccess: () => void }) {
  const [form, setForm] = useState({
    client_nom: "",
    client_telephone: "",
    client_adresse: "",
    zone: "",
    plats: "",
    montant_repas: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await commandesService.creer({
        client_nom: form.client_nom,
        client_telephone: form.client_telephone,
        client_adresse: form.client_adresse,
        zone: form.zone || undefined,
        plats: form.plats,
        montant_repas: Number(form.montant_repas),
        restaurant_id: "00000000-0000-0000-0000-000000000001",
      });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="text-xs text-muted-foreground">Équipe assignée automatiquement : <span className="font-semibold text-primary">{equipe}</span></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nom complet</Label><Input required value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} /></div>
        <div><Label>Téléphone</Label><Input required value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} /></div>
      </div>
      <div><Label>Adresse</Label><Input required value={form.client_adresse} onChange={(e) => setForm({ ...form, client_adresse: e.target.value })} /></div>
      <div><Label>Zone (ex: Mermoz, Almadies)</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
      <div><Label>Plats commandés</Label><Textarea required rows={4} placeholder="Un plat par ligne" value={form.plats} onChange={(e) => setForm({ ...form, plats: e.target.value })} /></div>
      <div><Label>Montant total des plats (FCFA)</Label><Input required type="number" min="0" value={form.montant_repas} onChange={(e) => setForm({ ...form, montant_repas: e.target.value })} /></div>
      <div className="text-xs text-muted-foreground">Le prix de livraison n'est pas saisi ici (perçu directement par le livreur).</div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Création…" : "Créer la commande"}</Button>
    </form>
  );
}
