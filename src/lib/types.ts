// Types métier Eguette

export type Equipe = "Matin" | "Soir";

export type StatutCommande =
  | "en_attente"
  | "acceptee"
  | "livree"
  | "annulee";

export type RoleUtilisateur = "admin" | "gestionnaire";

export interface Restaurant {
  id: string;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  created_at?: string;
}

export interface Livreur {
  id: string;
  nom: string;
  telephone: string;
  restaurant_id?: string | null;
  equipe: Equipe;
  en_service: boolean;
  created_at?: string;
}

export interface Commande {
  id: string;
  restaurant_id?: string | null;
  client_nom: string;
  client_telephone: string;
  client_adresse: string;
  zone?: string | null;
  plats: string;
  montant_repas: number;
  frais_livraison: number;
  statut: StatutCommande;
  equipe: Equipe;
  livreur_id?: string | null;
  livree_at?: string | null;
  annulee_at?: string | null;
  duree_livraison?: number | null;
  motif_annulation?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CommissionJournaliere {
  id: string;
  livreur_id: string;
  date_activite: string;
  nb_courses: number;
  montant_commission: number;
  payee: boolean;
}

export interface UserRole {
  user_id: string;
  role: RoleUtilisateur;
}

export function calculerEquipe(date: Date = new Date()): Equipe {
  const h = date.getHours();
  return h >= 11 && h < 21 ? "Matin" : "Soir";
}