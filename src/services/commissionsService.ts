import { supabase } from "@/lib/supabase";
import type { Commande } from "@/lib/types";

export interface CommissionLivreur {
  livreur_id: string;
  livreur_nom: string;
  nb_courses: number;
  commission: number;
  payee: boolean;
  commission_id?: string; // id row commissions_journalieres si existe
}

const MONTANT = 1000;

export const commissionsService = {
  // Calcule les commissions du jour à partir des commandes livrées
  // + croise avec la table commissions_journalieres pour le statut "payée"
  async calculerJour(
    date: string = new Date().toISOString().slice(0, 10),
  ): Promise<CommissionLivreur[]> {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;

    const [
      { data: commandes, error: e1 },
      { data: livreurs, error: e2 },
      { data: rows, error: e3 },
    ] = await Promise.all([
      supabase
        .from("commandes")
        .select("livreur_id")
        .eq("statut", "livree")
        .gte("livree_at", start)
        .lte("livree_at", end),
      supabase.from("livreurs").select("id, nom_complet"),
      supabase
        .from("commissions_journalieres")
        .select("id, livreur_id, payee, montant_commission, nb_courses")
        .gte("date_activite", `${date}T00:00:00`)
        .lte("date_activite", `${date}T23:59:59`),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const counts = new Map<string, number>();
    (commandes as Pick<Commande, "livreur_id">[] | null)?.forEach((c) => {
      if (!c.livreur_id) return;
      counts.set(c.livreur_id, (counts.get(c.livreur_id) ?? 0) + 1);
    });

    const noms = new Map<string, string>();
    (livreurs as { id: string; nom_complet: string }[] | null)?.forEach((l) =>
      noms.set(l.id, l.nom_complet),
    );

    const rowsByLivreur = new Map<
      string,
      { id: string; payee: boolean; nb_courses: number }
    >();
    (rows as
      | { id: string; livreur_id: string; payee: boolean; nb_courses: number }[]
      | null)?.forEach((r) =>
      rowsByLivreur.set(r.livreur_id, {
        id: r.id,
        payee: !!r.payee,
        nb_courses: r.nb_courses ?? 0,
      }),
    );

    // Union livreurs ayant des courses + livreurs ayant déjà une ligne commission ce jour
    const livreurIds = new Set<string>([
      ...counts.keys(),
      ...rowsByLivreur.keys(),
    ]);

    const result: CommissionLivreur[] = [];
    livreurIds.forEach((livreur_id) => {
      const row = rowsByLivreur.get(livreur_id);
      const nb = counts.get(livreur_id) ?? row?.nb_courses ?? 0;
      result.push({
        livreur_id,
        livreur_nom: noms.get(livreur_id) ?? "Inconnu",
        nb_courses: nb,
        commission: MONTANT,
        payee: row?.payee ?? false,
        commission_id: row?.id,
      });
    });
    return result.sort((a, b) => b.nb_courses - a.nb_courses);
  },

  // Marque comme payée — upsert sur (livreur_id, date_activite)
  async marquerPayee(params: {
    livreur_id: string;
    date_activite: string;
    nb_courses: number;
    montant_commission: number;
    commission_id?: string;
  }): Promise<void> {
    if (params.commission_id) {
      const { error } = await supabase
        .from("commissions_journalieres")
        .update({ payee: true })
        .eq("id", params.commission_id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from("commissions_journalieres").upsert(
      {
        livreur_id: params.livreur_id,
        date_activite: params.date_activite,
        nb_courses: params.nb_courses,
        montant_commission: params.montant_commission,
        payee: true,
      },
      { onConflict: "livreur_id,date_activite" },
    );
    if (error) throw error;
  },

  totalCommission(items: CommissionLivreur[]): number {
    return items.reduce((s, i) => s + i.commission, 0);
  },
};
