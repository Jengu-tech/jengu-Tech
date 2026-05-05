import { supabase } from "@/lib/supabase";
import { calculerEquipe, type Commande, type StatutCommande } from "@/lib/types";

export interface NouvelleCommande {
  client_nom: string;
  client_telephone: string;
  client_adresse: string;
  zone?: string;
  plats: string;
  montant_repas: number;
  frais_livraison?: number;
  restaurant_id?: string;
}

type CommandeRow = {
  id: string;
  client_nom: string;
  client_telephone: string;
  adresse_livraison: string;
  zone: string | null;
  plats: string | null;
  montant_repas: number | string | null;
  frais_livraison: number | string | null;
  statut: StatutCommande;
  equipe: "Matin" | "Soir" | null;
  livreur_id: string | null;
  livree_at: string | null;
  annulee_at: string | null;
  duree_livraison: number | null;
  motif_annulation: string | null;
  created_at: string;
  updated_at?: string | null;
  restaurant_id?: string | null;
};

function fromRow(r: CommandeRow): Commande {
  const createdAt = r.created_at ?? r.updated_at ?? new Date().toISOString();
  const livreeAt = r.statut === "livree" ? r.livree_at : null;
  const annuleeAt = r.statut === "annulee" ? r.annulee_at : null;
  return {
    id: r.id,
    client_nom: r.client_nom,
    client_telephone: r.client_telephone,
    client_adresse: r.adresse_livraison,
    zone: r.zone,
    plats: r.plats ?? "",
    montant_repas: Number(r.montant_repas ?? 0),
    frais_livraison: Number(r.frais_livraison ?? 0),
    statut: r.statut,
    equipe: (r.equipe ?? "Matin") as "Matin" | "Soir",
    livreur_id: r.livreur_id,
    livree_at: livreeAt,
    annulee_at: annuleeAt,
    duree_livraison: r.duree_livraison ?? null,
    motif_annulation: r.motif_annulation ?? null,
    created_at: createdAt,
    updated_at: r.updated_at ?? undefined,
    restaurant_id: r.restaurant_id ?? null,
  };
}

function toInsertRow(c: NouvelleCommande, equipe: "Matin" | "Soir") {
  return {
    client_nom: c.client_nom,
    client_telephone: c.client_telephone,
    adresse_livraison: c.client_adresse,
    zone: c.zone ?? null,
    plats: c.plats,
    montant_repas: c.montant_repas,
    frais_livraison: c.frais_livraison ?? 0,
    statut: "en_attente" as StatutCommande,
    equipe,
    livreur_id: null as string | null,
    restaurant_id: c.restaurant_id ?? null,
  };
}

export const commandesService = {
  async lister(filtres?: {
    date?: string;
    statut?: StatutCommande;
    equipe?: "Matin" | "Soir";
  }): Promise<Commande[]> {
    let q = supabase
      .from("commandes")
      .select("*")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("livree_at", { ascending: false, nullsFirst: false });
    if (filtres?.statut) q = q.eq("statut", filtres.statut);
    if (filtres?.equipe) q = q.eq("equipe", filtres.equipe);
    if (filtres?.date) {
      const start = `${filtres.date}T00:00:00`;
      const end = `${filtres.date}T23:59:59`;
      q = q.gte("created_at", start).lte("created_at", end);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => fromRow(r as CommandeRow));
  },

  async creer(c: NouvelleCommande): Promise<Commande> {
    const equipe = calculerEquipe();
    const nowIso = new Date().toISOString();
    const payload = { ...toInsertRow(c, equipe), created_at: nowIso, updated_at: nowIso };
    const { data, error } = await supabase
      .from("commandes")
      .insert(payload)
      .select()
      .single();
    if (error) {
      const msg = `${error.code ?? "ERR"} — ${error.message}${error.details ? " (" + error.details + ")" : ""}${error.hint ? " | hint: " + error.hint : ""}`;
      throw new Error(msg);
    }
    return fromRow(data as CommandeRow);
  },

  async assignerLivreur(commandeId: string, livreurId: string): Promise<Commande> {
    const { data, error } = await supabase
      .from("commandes")
      .update({ livreur_id: livreurId, statut: "acceptee" as StatutCommande })
      .eq("id", commandeId)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CommandeRow);
  },

  async refuserParLivreur(commandeId: string): Promise<Commande> {
    const { data, error } = await supabase
      .from("commandes")
      .update({ livreur_id: null, statut: "en_attente" })
      .eq("id", commandeId)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CommandeRow);
  },

  async changerStatut(commandeId: string, statut: StatutCommande): Promise<void> {
    const patch: Record<string, unknown> = { statut };
    if (statut === "livree") patch.livree_at = new Date().toISOString();
    if (statut === "annulee") patch.annulee_at = new Date().toISOString();
    const { error } = await supabase.from("commandes").update(patch).eq("id", commandeId);
    if (error) throw error;
  },

  async creerEnLot(commandes: NouvelleCommande[]): Promise<number> {
    const equipe = calculerEquipe();
    const nowIso = new Date().toISOString();
    const rows = commandes.map((c) => ({ ...toInsertRow(c, equipe), created_at: nowIso, updated_at: nowIso }));
    const { error, count } = await supabase
      .from("commandes")
      .insert(rows, { count: "exact" });
    if (error) throw error;
    return count ?? rows.length;
  },

  ecouterChangements(callback: () => void): () => void {
    const channel = supabase
      .channel("commandes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes" },
        () => callback(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};