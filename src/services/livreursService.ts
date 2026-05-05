import { supabase } from "@/lib/supabase";
import type { Livreur } from "@/lib/types";

export interface NouveauLivreur {
  nom: string;
  telephone: string;
  restaurant_id?: string;
  equipe: "Matin" | "Soir";
}

// Mapping DB <-> App
// DB: nom_complet, telephone, en_service, equipe, restaurant_id
// App: nom, telephone, en_service, equipe, restaurant_id
type LivreurRow = {
  id: string;
  nom_complet: string;
  telephone: string;
  en_service: boolean;
  equipe: "Matin" | "Soir" | null;
  restaurant_id: string | null;
  created_at?: string;
};

function fromRow(r: LivreurRow): Livreur {
  return {
    id: r.id,
    nom: r.nom_complet,
    telephone: r.telephone,
    en_service: !!r.en_service,
    equipe: (r.equipe ?? "Matin") as "Matin" | "Soir",
    restaurant_id: r.restaurant_id,
    created_at: r.created_at,
  };
}

function toRow(l: NouveauLivreur & { en_service?: boolean }) {
  return {
    nom_complet: l.nom,
    telephone: l.telephone,
    equipe: l.equipe,
    restaurant_id: l.restaurant_id ?? null,
    en_service: l.en_service ?? false,
  };
}

export const livreursService = {
  async lister(): Promise<Livreur[]> {
    const { data, error } = await supabase
      .from("livreurs")
      .select("*")
      .order("nom_complet", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => fromRow(r as LivreurRow));
  },

  async listerEnService(equipe?: "Matin" | "Soir"): Promise<Livreur[]> {
    let q = supabase.from("livreurs").select("*").eq("en_service", true);
    if (equipe) q = q.eq("equipe", equipe);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => fromRow(r as LivreurRow));
  },

  async ajouter(l: NouveauLivreur): Promise<Livreur> {
    const { data, error } = await supabase
      .from("livreurs")
      .insert(toRow(l))
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as LivreurRow);
  },

  async ajouterEnLot(livreurs: NouveauLivreur[]): Promise<number> {
    const rows = livreurs.map((l) => toRow(l));
    const { error, count } = await supabase
      .from("livreurs")
      .insert(rows, { count: "exact" });
    if (error) throw error;
    return count ?? rows.length;
  },

  ecouterChangements(callback: () => void): () => void {
    // Nom de canal UNIQUE par abonné : sinon Supabase réutilise un canal déjà
    // .subscribe() et lève "cannot add postgres_changes callbacks ... after subscribe()".
    const channelName = `livreurs-realtime-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "livreurs" },
        () => callback(),
      )
      .subscribe();

    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;
      supabase.removeChannel(channel);
    };
  },
};
